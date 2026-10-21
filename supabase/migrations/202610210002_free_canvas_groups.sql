-- Safe additive validation for optional v1 free-canvas/group metadata. No stored rows are rewritten.
create or replace function public.validate_project(value jsonb, who uuid, published boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare source text;
begin
 if jsonb_typeof(value) is distinct from 'object' or value->>'version' is distinct from '1'
 or jsonb_typeof(value->'page') is distinct from 'object'
 or jsonb_typeof(value->'blocks') is distinct from 'array'
 then raise exception 'INVALID_PROJECT'; end if;
 if jsonb_array_length(value->'blocks')>200 or length(value::text)>4000000
 or coalesce(value->'page'->>'columns','') not in ('3','4','5') then raise exception 'INVALID_PROJECT'; end if;
 if value ? 'customFonts' and (jsonb_typeof(value->'customFonts') is distinct from 'array') then raise exception 'INVALID_PROJECT'; end if;
 if jsonb_array_length(coalesce(value->'customFonts','[]'::jsonb))>8 then raise exception 'INVALID_PROJECT'; end if;
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where b->>'type' not in ('link','text','image','gif','video','audio','qrcode','decoration') or b->>'type' is null) then raise exception 'INVALID_PROJECT'; end if;
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where jsonb_typeof(b->'id') is distinct from 'string' or length(b->>'id') not between 1 and 100)
 or exists(select 1 from jsonb_array_elements(value->'blocks') b group by b->>'id' having count(*)>1) then raise exception 'INVALID_PROJECT'; end if;
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where b->>'type' in ('link','qrcode') and coalesce(b->>'url','')<>'' and b->>'url' !~ '^https?://[^[:space:]]+$') then raise exception 'INVALID_ASSET_SOURCE'; end if;
 -- Optional editor fields default to legacy behavior when absent.
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where
   (b ? 'locked' and jsonb_typeof(b->'locked') is distinct from 'boolean') or
   (b ? 'hidden' and jsonb_typeof(b->'hidden') is distinct from 'boolean')) then raise exception 'INVALID_EDITOR_FIELDS'; end if;
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where b ? 'layer' and
   (jsonb_typeof(b->'layer') is distinct from 'number')) then raise exception 'INVALID_EDITOR_FIELDS'; end if;
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where b ? 'layer' and
   ((b->>'layer')::numeric < 0 or (b->>'layer')::numeric > 1000000 or trunc((b->>'layer')::numeric) <> (b->>'layer')::numeric)) then raise exception 'INVALID_EDITOR_FIELDS'; end if;

 if value ? 'groups' and jsonb_typeof(value->'groups') is distinct from 'array' then raise exception 'INVALID_GROUPS'; end if;
 if jsonb_array_length(coalesce(value->'groups','[]'::jsonb))>100 then raise exception 'INVALID_GROUPS'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(value->'groups','[]'::jsonb)) g where jsonb_typeof(g->'id') is distinct from 'string' or length(g->>'id') not between 1 and 100 or jsonb_typeof(g->'name') is distinct from 'string' or length(g->>'name')>160)
 or exists(select 1 from jsonb_array_elements(coalesce(value->'groups','[]'::jsonb)) g group by g->>'id' having count(*)>1) then raise exception 'INVALID_GROUPS'; end if;
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where
 (b ? 'layout' and (jsonb_typeof(b->'layout') is distinct from 'string' or b->>'layout' not in ('grid','free'))) or
 (b ? 'keepAspect' and jsonb_typeof(b->'keepAspect') is distinct from 'boolean') or
 (b ? 'groupId' and (jsonb_typeof(b->'groupId') is distinct from 'string' or coalesce(b->>'layout',case when b->>'type'='decoration' then 'free' else 'grid' end)<>'free' or not exists(select 1 from jsonb_array_elements(coalesce(value->'groups','[]'::jsonb)) g where g->>'id'=b->>'groupId')))) then raise exception 'INVALID_CREATIVE_FIELDS'; end if;

 if exists(select 1 from jsonb_array_elements(value->'blocks') b cross join unnest(array['x','y','width','height','rotation']) field where b->>'layout'='free' and jsonb_typeof(b->field) is distinct from 'number') then raise exception 'INVALID_FREE_GEOMETRY'; end if;
 if exists(select 1 from jsonb_array_elements(value->'blocks') b where b->>'layout'='free' and (abs((b->>'x')::numeric)>1000000 or abs((b->>'y')::numeric)>1000000 or (b->>'width')::numeric not between 24 and 100000 or (b->>'height')::numeric not between 24 and 100000 or (b->>'rotation')::numeric not between -360 and 360)) then raise exception 'INVALID_FREE_GEOMETRY'; end if;
 for source in select * from public.project_sources(value) loop
  if source is null or source='' then continue; end if;
  if source like 'cloud:%' and not published then
   if not exists(select 1 from public.assets a where a.path=substring(source from 7) and a.owner_id=who and a.state='ready') then raise exception 'ASSET_NOT_READY'; end if;
  elsif source !~ '^https?://[^[:space:]]+$' then raise exception 'INVALID_ASSET_SOURCE';
  end if;
 end loop;
end;
$$;
revoke execute on function public.validate_project(jsonb,uuid,boolean) from public,anon,authenticated;
grant execute on function public.validate_project(jsonb,uuid,boolean) to service_role;

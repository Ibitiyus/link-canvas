-- Cache the initial published title when consent is first saved. Search never
-- reads or de-toasts the large project JSON; it only joins the publication key.
create or replace function public.set_explore_visibility(visible boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if visible is null then raise exception 'INVALID_REQUEST'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 perform public.take_operation(auth.uid(),'explore-visibility',30,60);
 insert into public.explore_settings(owner_id,listed,first_listed_at,published_title)
 values(auth.uid(),visible,case when visible then now() end,coalesce((select left(project->'page'->>'title',80) from public.published_pages where owner_id=auth.uid()),''))
 on conflict(owner_id) do update set listed=excluded.listed,first_listed_at=coalesce(public.explore_settings.first_listed_at,excluded.first_listed_at);
end; $$;
create or replace function public.snapshot_explore_metadata() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.explore_settings set published_title=coalesce(nullif(title,''),left(new.project->'page'->>'title',80),'Без названия'),published_description=description,published_category=category,published_cover=cover,metadata_published_at=now() where owner_id=new.owner_id;
 return new;
end; $$;
-- A replacement of the same bounded public projection, with no project column access.
create or replace function public.search_explore(search_text text default '',category_filter text default '',sort_order text default 'new',page_offset integer default 0,page_size integer default 12,random_seed text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pattern text; result jsonb;
begin
 if search_text is null or char_length(search_text)>100 or category_filter is null or sort_order is null or sort_order not in ('new','updated','random')
 or page_offset is null or page_offset not between 0 and 10000 or page_size is null or page_size not between 1 and 24 or random_seed is null or char_length(random_seed)>64
 or (category_filter<>'' and category_filter not in ('Art & Design','Music','Personal','Gaming','Photography','Cybercore','Punk / Grunge','Old Web','Other')) then raise exception 'INVALID_REQUEST'; end if;
 pattern:='%'||replace(replace(replace(lower(trim(search_text)),'\','\\'),'%','\%'),'_','\_')||'%';
 with candidates as (
 select p.username,coalesce(nullif(s.published_title,''),'Без названия') as title,
 s.published_description as description,s.published_category as category,s.published_cover as cover,
 s.first_listed_at as listed_at,greatest(p.published_at,s.metadata_published_at) as updated_at,
 row_number() over(order by
 case when sort_order='new' then s.first_listed_at end desc,
 case when sort_order='updated' then greatest(p.published_at,s.metadata_published_at) end desc,
 case when sort_order='random' then md5(s.owner_id::text||random_seed) end,p.username) as ordinal
 from public.explore_settings s join public.published_pages p on p.owner_id=s.owner_id
 where s.listed and not exists(select 1 from public.explore_moderation m where m.owner_id=s.owner_id and m.hidden)
 and (category_filter='' or s.published_category=category_filter)
 and (trim(search_text)='' or lower(p.username) like pattern escape '\' or lower(s.published_title||' '||s.published_description) like pattern escape '\')
 order by ordinal offset page_offset limit page_size+1
 ), items as (select * from candidates order by ordinal limit page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)-'ordinal' order by ordinal) from items i),'[]'::jsonb),
 'has_more',(select count(*)>page_size from candidates) and page_offset+page_size<=10000,'next_offset',page_offset+page_size) into result;
 return result;
end; $$;

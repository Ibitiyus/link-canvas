-- Additive discovery catalogue. Existing publications are NEVER opted in.
create extension if not exists pg_trgm with schema extensions;
create table public.explore_settings (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 listed boolean not null default false,
 title text not null default '' check(char_length(title)<=80),
 description text not null default '' check(char_length(description)<=280),
 category text not null default 'Other' check(category in ('Art & Design','Music','Personal','Gaming','Photography','Cybercore','Punk / Grunge','Old Web','Other')),
 cover text not null default '' check(octet_length(cover)<=87408),
 published_title text not null default '', published_description text not null default '',
 published_category text not null default 'Other', published_cover text not null default '',
 metadata_published_at timestamptz, first_listed_at timestamptz
);
create table public.explore_moderation (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 hidden boolean not null default false, reason text not null default '', updated_at timestamptz not null default now()
);
create table public.explore_reports (
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 subject_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check(reason in ('spam','unsafe','rights','other')),
 details text not null check(char_length(details)<=500),
 created_at timestamptz not null default now(), primary key(reporter_id,subject_id)
);
alter table public.explore_settings enable row level security;
alter table public.explore_moderation enable row level security;
alter table public.explore_reports enable row level security;
revoke all on public.explore_settings,public.explore_moderation,public.explore_reports from anon,authenticated;
grant select on public.explore_settings to authenticated;
create policy explore_owner_read on public.explore_settings for select to authenticated using(owner_id=(select auth.uid()));
grant all on public.explore_settings,public.explore_moderation,public.explore_reports to service_role;
create index explore_listed on public.explore_settings(first_listed_at desc,owner_id) where listed;
create index explore_category on public.explore_settings(published_category,first_listed_at desc) where listed;
do $$ declare extension_schema text;
begin
 select n.nspname into extension_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 execute format('create index explore_text on public.explore_settings using gin(lower(published_title||'' ''||published_description) %I.gin_trgm_ops) where listed',extension_schema);
 execute format('create index explore_username on public.published_pages using gin(lower(username) %I.gin_trgm_ops)',extension_schema);
end; $$;

-- Covers are tiny, self-contained JPEG thumbnails, never HTML/SVG/GIF/external URLs.
-- Keeping this bounded payload avoids fetching source projects or private Storage assets.
create function public.valid_explore_cover(value text) returns boolean
language plpgsql immutable set search_path='' as $$
declare bytes bytea;
begin
 if value='' then return true; end if;
 if value is null or octet_length(value)>87408 or value !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
 bytes:=decode(substr(value,24),'base64');
 return octet_length(bytes) between 4 and 65536 and substring(bytes from 1 for 3)=decode('ffd8ff','hex') and substring(bytes from octet_length(bytes)-1 for 2)=decode('ffd9','hex');
exception when others then return false;
end; $$;
alter table public.explore_settings add constraint explore_safe_cover check(public.valid_explore_cover(cover) and public.valid_explore_cover(published_cover));

create function public.save_explore_settings(new_title text,new_description text,new_category text,new_cover text,publish_now boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 perform public.take_operation(auth.uid(),'explore-settings',30,60);
 if new_title is null or char_length(trim(new_title)) not between 1 and 80 or new_description is null or char_length(new_description)>280
 or new_category is null or new_category not in ('Art & Design','Music','Personal','Gaming','Photography','Cybercore','Punk / Grunge','Old Web','Other')
 or not public.valid_explore_cover(new_cover) then raise exception 'INVALID_EXPLORE_METADATA'; end if;
 if publish_now and not exists(select 1 from public.published_pages where owner_id=auth.uid()) then raise exception 'PAGE_NOT_PUBLISHED'; end if;
 insert into public.explore_settings(owner_id,title,description,category,cover) values(auth.uid(),trim(new_title),trim(new_description),new_category,new_cover)
 on conflict(owner_id) do update set title=excluded.title,description=excluded.description,category=excluded.category,cover=excluded.cover;
 if publish_now then
 update public.explore_settings set published_title=title,published_description=description,published_category=category,published_cover=cover,metadata_published_at=now() where owner_id=auth.uid();
 end if;
end; $$;

create function public.set_explore_visibility(visible boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if visible is null then raise exception 'INVALID_REQUEST'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 perform public.take_operation(auth.uid(),'explore-visibility',30,60);
 insert into public.explore_settings(owner_id,listed,first_listed_at) values(auth.uid(),visible,case when visible then now() end)
 on conflict(owner_id) do update set listed=excluded.listed,first_listed_at=coalesce(public.explore_settings.first_listed_at,excluded.first_listed_at);
 -- Moderation is deliberately untouched; authors cannot bypass an administrative hide.
end; $$;

-- Snapshot metadata only on an explicit publication, never on username cascading updates.
create function public.snapshot_explore_metadata() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.explore_settings set published_title=title,published_description=description,published_category=category,published_cover=cover,metadata_published_at=now() where owner_id=new.owner_id;
 return new;
end; $$;
create trigger snapshot_explore_metadata after insert or update of project,source_revision on public.published_pages for each row execute function public.snapshot_explore_metadata();

create function public.search_explore(search_text text default '',category_filter text default '',sort_order text default 'new',page_offset integer default 0,page_size integer default 12,random_seed text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pattern text; result jsonb;
begin
 if search_text is null or char_length(search_text)>100 or category_filter is null or sort_order is null or sort_order not in ('new','updated','random')
 or page_offset is null or page_offset not between 0 and 10000 or page_size is null or page_size not between 1 and 24 or random_seed is null or char_length(random_seed)>64
 or (category_filter<>'' and category_filter not in ('Art & Design','Music','Personal','Gaming','Photography','Cybercore','Punk / Grunge','Old Web','Other')) then raise exception 'INVALID_REQUEST'; end if;
 pattern:='%'||replace(replace(replace(lower(trim(search_text)),'\','\\'),'%','\%'),'_','\_')||'%';
 with candidates as (
 select p.username,coalesce(nullif(s.published_title,''),left(p.project->'page'->>'title',80),'Без названия') as title,
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
 'has_more',(select count(*)>page_size from candidates),'next_offset',page_offset+page_size) into result;
 return result;
end; $$;

-- Reporting requires an account: no reporter email/contact information is requested or public.
create function public.report_explore(page_username text,report_reason text,report_details text default '') returns void
language plpgsql security definer set search_path='' as $$
declare subject uuid;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if report_reason is null or report_reason not in ('spam','unsafe','rights','other') or report_details is null or char_length(report_details)>500 then raise exception 'INVALID_REQUEST'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 perform public.take_operation(auth.uid(),'explore-report',5,86400);
 select p.owner_id into subject from public.published_pages p join public.explore_settings s on s.owner_id=p.owner_id
 where p.username=page_username and s.listed and not exists(select 1 from public.explore_moderation m where m.owner_id=p.owner_id and m.hidden);
 if subject is null then raise exception 'PAGE_NOT_AVAILABLE'; end if;
 insert into public.explore_reports(reporter_id,subject_id,reason,details) values(auth.uid(),subject,report_reason,trim(report_details))
 on conflict(reporter_id,subject_id) do update set reason=excluded.reason,details=excluded.details,created_at=now();
end; $$;

-- Server/service role only; NEVER expose this credential in a browser.
create function public.moderate_explore(page_username text,hide boolean,moderation_reason text default '') returns void
language plpgsql security definer set search_path='' as $$
declare subject uuid;
begin
 if hide is null or moderation_reason is null or char_length(moderation_reason)>500 then raise exception 'INVALID_REQUEST'; end if;
 select id into subject from public.profiles where username=page_username for update;
 if subject is null then raise exception 'PAGE_NOT_AVAILABLE'; end if;
 insert into public.explore_moderation(owner_id,hidden,reason) values(subject,hide,moderation_reason)
 on conflict(owner_id) do update set hidden=excluded.hidden,reason=excluded.reason,updated_at=now();
end; $$;
revoke execute on function public.valid_explore_cover(text),public.save_explore_settings(text,text,text,text,boolean),public.set_explore_visibility(boolean),public.snapshot_explore_metadata(),public.search_explore(text,text,text,integer,integer,text),public.report_explore(text,text,text),public.moderate_explore(text,boolean,text) from public,anon,authenticated;
grant execute on function public.search_explore(text,text,text,integer,integer,text) to anon,authenticated,service_role;
grant execute on function public.save_explore_settings(text,text,text,text,boolean),public.set_explore_visibility(boolean),public.report_explore(text,text,text) to authenticated,service_role;
grant execute on function public.moderate_explore(text,boolean,text),public.valid_explore_cover(text) to service_role;

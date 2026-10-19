-- One owner, one private draft, one independently published snapshot.
create or replace function public.valid_username(value text) returns boolean
language sql immutable set search_path = '' as $$
 select value ~ '^[a-z][a-z0-9_]{2,29}$' and value not in
 ('admin','administrator','api','app','auth','dashboard','editor','help','login','logout','moderator','preview','public','register','reset','root','settings','storage','supabase','support','system','user','users','www','zin');
$$;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(public.valid_username(username)),
 created_at timestamptz not null default now(), renamed_at timestamptz
);
create table public.drafts (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 project jsonb not null, revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table public.published_pages (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 username text not null unique references public.profiles(username) on update cascade on delete cascade,
 project jsonb not null, source_revision bigint not null,
 published_at timestamptz not null default now()
);
create table public.assets (
 path text primary key, owner_id uuid not null references public.profiles(id) on delete cascade,
 mime text not null, size bigint not null check(size > 0),
 state text not null default 'uploading' check(state in ('uploading','ready','deleting')),
 created_at timestamptz not null default now()
);
create index assets_owner on public.assets(owner_id);
create table public.publication_jobs (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 token uuid not null default gen_random_uuid(), revision bigint not null,
 project jsonb not null, expires_at timestamptz not null default now() + interval '15 minutes'
);
create table public.operation_limits (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 operation text not null, window_start timestamptz not null, count integer not null default 1,
 primary key(owner_id,operation)
);
alter table public.profiles enable row level security;
alter table public.drafts enable row level security;
alter table public.published_pages enable row level security;
alter table public.assets enable row level security;
alter table public.publication_jobs enable row level security;
alter table public.operation_limits enable row level security;
revoke all on public.profiles,public.drafts,public.published_pages,public.assets,public.publication_jobs,public.operation_limits from anon, authenticated;
grant select on public.profiles,public.drafts,public.assets to authenticated;
grant select on public.published_pages to anon,authenticated;
create policy profiles_owner on public.profiles for select to authenticated using(id=auth.uid());
create policy drafts_owner on public.drafts for select to authenticated using(owner_id=auth.uid());
create policy assets_owner on public.assets for select to authenticated using(owner_id=auth.uid());
create policy published_read on public.published_pages for select to anon,authenticated using(true);

create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username) values(new.id,lower(trim(new.raw_user_meta_data->>'username')));
 return new;
end;
$$;
create trigger zin_profile after insert on auth.users for each row execute function public.create_profile();
create or replace function public.username_available(value text) returns boolean language sql stable security definer set search_path='' as $$
 select public.valid_username(value) and not exists(select 1 from public.profiles where username=value);
$$;
create or replace function public.rename_username(value text) returns text language plpgsql security definer set search_path='' as $$
declare profile public.profiles;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if not public.valid_username(value) then raise exception 'INVALID_USERNAME'; end if;
 select * into profile from public.profiles where id=auth.uid() for update;
 if profile.username=value then return value; end if;
 if profile.renamed_at > now()-interval '1 minute' then raise exception 'RATE_LIMIT'; end if;
 update public.profiles set username=value,renamed_at=now() where id=auth.uid();
 return value;
end;
$$;
-- This helper is intentionally not executable by API roles.
create or replace function public.take_operation(who uuid, action text, max_count integer, window_seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 insert into public.operation_limits(owner_id,operation,window_start) values(who,action,now())
 on conflict(owner_id,operation) do update set
 count=case when public.operation_limits.window_start < now()-make_interval(secs=>window_seconds) then 1 else public.operation_limits.count+1 end,
 window_start=case when public.operation_limits.window_start < now()-make_interval(secs=>window_seconds) then now() else public.operation_limits.window_start end
 returning count into total;
 if total>max_count then raise exception 'RATE_LIMIT'; end if;
end;
$$;
create or replace function public.project_sources(value jsonb) returns setof text language sql immutable set search_path='' as $$
 select value->'page'->>'backgroundImage'
 union all select font->>'dataUrl' from jsonb_array_elements(coalesce(value->'customFonts','[]'::jsonb)) font
 union all select block->>'imageUrl' from jsonb_array_elements(value->'blocks') block
 union all select block->>'url' from jsonb_array_elements(value->'blocks') block where block->>'type' in ('image','gif','video','audio');
$$;
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
 for source in select * from public.project_sources(value) loop
  if source is null or source='' then continue; end if;
  if source like 'cloud:%' and not published then
   if not exists(select 1 from public.assets a where a.path=substring(source from 7) and a.owner_id=who and a.state='ready') then raise exception 'ASSET_NOT_READY'; end if;
  elsif source !~ '^https?://[^[:space:]]+$' then raise exception 'INVALID_ASSET_SOURCE';
  end if;
 end loop;
end;
$$;
create or replace function public.save_draft(value jsonb, expected_revision bigint) returns public.drafts language plpgsql security definer set search_path='' as $$
declare current public.drafts;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 -- Lock the profile too: draft creation and asset cleanup share this lock.
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into current from public.drafts where owner_id=auth.uid() for update;
 if coalesce(current.revision,0)<>expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 perform public.take_operation(auth.uid(),'save',180,60);
 perform public.validate_project(value,auth.uid());
 insert into public.drafts(owner_id,project,revision) values(auth.uid(),value,1)
 on conflict(owner_id) do update set project=excluded.project,revision=public.drafts.revision+1,updated_at=now()
 returning * into current;
 return current;
end;
$$;
create or replace function public.reserve_asset(file_id uuid, extension text, content_type text, bytes bigint) returns text language plpgsql security definer set search_path='' as $$
declare path text; max_bytes bigint;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if extension !~ '^(png|jpg|webp|gif|mp4|webm|ogg|mov|mp3|wav|m4a|aac|flac|woff2?|ttf|otf)$'
 or content_type not in ('image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/ogg','video/quicktime','audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac','audio/flac','audio/webm','font/woff2','font/woff','font/ttf','font/otf') then raise exception 'UNSUPPORTED_FILE'; end if;
 select file_size_limit into max_bytes from storage.buckets where id='zin-drafts';
 if bytes<=0 or (max_bytes is not null and bytes>max_bytes) then raise exception 'FILE_TOO_LARGE'; end if;
 perform public.take_operation(auth.uid(),'upload',600,3600);
 path=auth.uid()::text||'/'||file_id::text||'.'||extension;
 insert into public.assets(path,owner_id,mime,size) values(path,auth.uid(),content_type,bytes);
 return path;
end;
$$;
create or replace function public.begin_publication(expected_revision bigint) returns public.publication_jobs language plpgsql security definer set search_path='' as $$
declare draft public.drafts; job public.publication_jobs;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 perform public.take_operation(auth.uid(),'publish',10,60);
 select * into draft from public.drafts where owner_id=auth.uid();
 if draft.revision is null or draft.revision<>expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 select * into job from public.publication_jobs where owner_id=auth.uid();
 if job.expires_at>now() then raise exception 'PUBLICATION_BUSY'; end if;
 insert into public.publication_jobs(owner_id,revision,project) values(auth.uid(),draft.revision,draft.project)
 on conflict(owner_id) do update set token=gen_random_uuid(),revision=excluded.revision,project=excluded.project,expires_at=now()+interval '15 minutes'
 returning * into job;
 return job;
end;
$$;
-- Only the Edge Function's server client may finalize a public snapshot.
create or replace function public.finish_publication(who uuid, job_token uuid, value jsonb) returns public.published_pages language plpgsql security definer set search_path='' as $$
declare job public.publication_jobs; result public.published_pages; current_name text;
begin
 select username into current_name from public.profiles where id=who for update;
 select * into job from public.publication_jobs where owner_id=who and token=job_token and expires_at>now() for update;
 if job.owner_id is null then raise exception 'PUBLICATION_CANCELLED'; end if;
 perform public.validate_project(value,who,true);
 insert into public.published_pages(owner_id,username,project,source_revision) values(who,current_name,value,job.revision)
 on conflict(owner_id) do update set username=excluded.username,project=excluded.project,source_revision=excluded.source_revision,published_at=now()
 returning * into result;
 delete from public.publication_jobs where owner_id=who;
 return result;
end;
$$;
create or replace function public.unpublish_page() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 perform public.take_operation(auth.uid(),'unpublish',10,60);
 delete from public.publication_jobs where owner_id=auth.uid();
 delete from public.published_pages where owner_id=auth.uid();
end;
$$;
create or replace function public.claim_unused_assets(who uuid) returns setof public.assets language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=who for update;
 perform public.take_operation(who,'cleanup',3,3600);
 return query update public.assets a set state='deleting' where a.owner_id=who and a.created_at<now()-interval '7 days'
 and not exists(select 1 from public.drafts d, lateral public.project_sources(d.project) s where d.owner_id=who and s='cloud:'||a.path)
 and not exists(select 1 from public.publication_jobs j, lateral public.project_sources(j.project) s where j.owner_id=who and j.expires_at>now() and s='cloud:'||a.path)
 returning a.*;
end;
$$;
-- Explicit function grants: SECURITY DEFINER helpers must never remain public.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.valid_username(text),public.username_available(text) to anon,authenticated;
grant execute on function public.rename_username(text),public.save_draft(jsonb,bigint),public.reserve_asset(uuid,text,text,bigint),public.begin_publication(bigint),public.unpublish_page() to authenticated;
grant execute on all functions in schema public to service_role;
-- 50 MiB is the default cloud quota; change both bucket limits for your plan.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('zin-drafts','zin-drafts',false,52428800,array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/ogg','video/quicktime','audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac','audio/flac','audio/webm','font/woff2','font/woff','font/ttf','font/otf']),
('zin-public','zin-public',true,52428800,array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/ogg','video/quicktime','audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac','audio/flac','audio/webm','font/woff2','font/woff','font/ttf','font/otf']);
create policy draft_file_read on storage.objects for select to authenticated using(bucket_id='zin-drafts' and exists(select 1 from public.assets a where a.path=name and a.owner_id=auth.uid() and a.state<>'deleting'));
create policy draft_file_upload on storage.objects for insert to authenticated with check(bucket_id='zin-drafts' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.assets a where a.path=name and a.owner_id=auth.uid() and a.state='uploading'));
-- No client INSERT/UPDATE/DELETE policy exists for public files. Only server publication writes them.
grant all on public.profiles,public.drafts,public.published_pages,public.assets,public.publication_jobs,public.operation_limits to service_role;

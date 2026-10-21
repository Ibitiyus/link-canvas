-- Verified private objects are immutable. Reuse their prior public copies,
-- including copies created by older token-based publication folders.
create function public.public_asset_copies(who uuid, source_paths text[])
returns table(source text, target text) language sql stable security definer set search_path='' as $$
 select a.path, min(o.name) from public.assets a join storage.objects o
 on o.bucket_id='zin-public' and (storage.foldername(o.name))[1]=who::text
 and split_part(o.name,'/',3)=split_part(a.path,'/',2)
 where a.owner_id=who and a.state='ready' and a.path=any(source_paths)
 group by a.path;
$$;
revoke execute on function public.public_asset_copies(uuid,text[]) from public,anon,authenticated;
grant execute on function public.public_asset_copies(uuid,text[]) to service_role;

create or replace function public.begin_publication(expected_revision bigint) returns public.publication_jobs
language plpgsql security definer set search_path='' as $$
declare used_bytes numeric; incoming_bytes numeric; job public.publication_jobs;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select coalesce(sum((metadata->>'size')::numeric),0) into used_bytes from storage.objects
 where bucket_id='zin-public' and (storage.foldername(name))[1]=auth.uid()::text;
 select coalesce(sum(a.size),0) into incoming_bytes from public.assets a where a.owner_id=auth.uid()
 and exists(select 1 from public.drafts d, lateral public.project_sources(d.project) s
 where d.owner_id=auth.uid() and s='cloud:'||a.path)
 and not exists(select 1 from storage.objects o where o.bucket_id='zin-public'
 and (storage.foldername(o.name))[1]=auth.uid()::text
 and split_part(o.name,'/',3)=split_part(a.path,'/',2));
 if used_bytes+incoming_bytes>536870912 then raise exception 'STORAGE_QUOTA'; end if;
 job:=public.begin_publication_v1(expected_revision);
 return job;
end;
$$;
revoke execute on function public.begin_publication(bigint) from public,anon;
grant execute on function public.begin_publication(bigint) to authenticated,service_role;

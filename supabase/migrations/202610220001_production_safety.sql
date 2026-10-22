-- Additive hardening. No rows, buckets or production Auth settings are changed.
-- Reserve quota under the same owner lock used by publication and draft writes.
alter function public.reserve_asset(uuid,text,text,bigint) rename to reserve_asset_v1;
revoke execute on function public.reserve_asset_v1(uuid,text,text,bigint) from public,anon,authenticated;
create function public.reserve_asset(file_id uuid, extension text, content_type text, bytes bigint) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if file_id is null or extension is null or content_type is null or bytes is null or bytes<=0 then raise exception 'UNSUPPORTED_FILE'; end if;
 if not exists(select 1 from (values
 ('png','image/png'),('jpg','image/jpeg'),('webp','image/webp'),('gif','image/gif'),
 ('mp4','video/mp4'),('webm','video/webm'),('ogg','video/ogg'),('mov','video/quicktime'),
 ('mp3','audio/mpeg'),('wav','audio/wav'),('ogg','audio/ogg'),('m4a','audio/mp4'),
 ('aac','audio/aac'),('flac','audio/flac'),('webm','audio/webm'),
 ('woff2','font/woff2'),('woff','font/woff'),('ttf','font/ttf'),('otf','font/otf')) formats(ext,mime)
 where formats.ext=extension and formats.mime=content_type) then raise exception 'UNSUPPORTED_FILE'; end if;
 if (select count(*) from public.assets where owner_id=auth.uid())>=1000
 or (select coalesce(sum(size),0) from public.assets where owner_id=auth.uid())+bytes>536870912 then raise exception 'STORAGE_QUOTA'; end if;
 result:=public.reserve_asset_v1(file_id,extension,content_type,bytes);
 return result;
end;
$$;
revoke execute on function public.reserve_asset(uuid,text,text,bigint) from public,anon;
grant execute on function public.reserve_asset(uuid,text,text,bigint) to authenticated,service_role;
-- A tiny declared reservation must not admit a large object or a different MIME.
-- Storage sets actual object size/MIME when committing standard and TUS uploads.
drop policy draft_file_upload on storage.objects;
create policy draft_file_upload on storage.objects for insert to authenticated with check(
 bucket_id='zin-drafts' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.assets a where a.path=name and a.owner_id=auth.uid() and a.state='uploading'
 and (metadata->>'size')::numeric=a.size and metadata->>'mimetype'=a.mime)
);

alter function public.begin_publication(bigint) rename to begin_publication_v1;
revoke execute on function public.begin_publication_v1(bigint) from public,anon,authenticated;
create function public.begin_publication(expected_revision bigint) returns public.publication_jobs
language plpgsql security definer set search_path='' as $$
declare used_bytes numeric; incoming_bytes numeric; job public.publication_jobs;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select coalesce(sum((metadata->>'size')::numeric),0) into used_bytes from storage.objects
 where bucket_id='zin-public' and (storage.foldername(name))[1]=auth.uid()::text;
 select coalesce(sum(a.size),0) into incoming_bytes from public.assets a where a.owner_id=auth.uid()
 and exists(select 1 from public.drafts d, lateral public.project_sources(d.project) s
 where d.owner_id=auth.uid() and s='cloud:'||a.path);
 if used_bytes+incoming_bytes>536870912 then raise exception 'STORAGE_QUOTA'; end if;
 job:=public.begin_publication_v1(expected_revision);
 return job;
end;
$$;
revoke execute on function public.begin_publication(bigint) from public,anon;
grant execute on function public.begin_publication(bigint) to authenticated,service_role;

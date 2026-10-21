-- Storage performs an RLS preflight with no final metadata. Enforce the actual
-- size/MIME at the database commit instead, including TUS metadata updates.
drop policy draft_file_upload on storage.objects;
create policy draft_file_upload on storage.objects for insert to authenticated with check(
 bucket_id='zin-drafts' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.assets a where a.path=name and a.owner_id=auth.uid() and a.state='uploading')
);
create function public.guard_asset_metadata() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id='zin-drafts' and new.metadata ? 'size' then
  if not exists(select 1 from public.assets a where a.path=new.name
    and a.size=(new.metadata->>'size')::numeric and a.mime=new.metadata->>'mimetype'
    and a.owner_id::text=(storage.foldername(new.name))[1]) then
   raise exception 'ASSET_METADATA_MISMATCH';
  end if;
 end if;
 return new;
end;
$$;
revoke execute on function public.guard_asset_metadata() from public,anon,authenticated;
grant execute on function public.guard_asset_metadata() to service_role;
create trigger zin_asset_metadata before insert or update of metadata,name,bucket_id on storage.objects
for each row execute function public.guard_asset_metadata();

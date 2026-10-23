-- Republishing an unchanged composition must still publish pending gallery metadata.
-- Edge checks revision, then this RPC checks it again while holding the owner lock.
create function public.publish_explore_metadata(expected_revision bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not exists(select 1 from public.published_pages p join public.drafts d on d.owner_id=p.owner_id
 where p.owner_id=auth.uid() and p.source_revision=expected_revision and d.revision=expected_revision) then raise exception 'REVISION_CONFLICT'; end if;
 perform public.take_operation(auth.uid(),'explore-settings',30,60);
 update public.explore_settings set published_title=coalesce(nullif(title,''),published_title),published_description=description,
 published_category=category,published_cover=cover,metadata_published_at=now() where owner_id=auth.uid();
end; $$;
revoke execute on function public.publish_explore_metadata(bigint) from public,anon;
grant execute on function public.publish_explore_metadata(bigint) to authenticated,service_role;

-- Commit the Edge request budget before the Storage/publication operation starts.
-- Thus failed uploads/publications also consume a budget, independently of RPC rollback.
create function public.authorize_edge_action(action text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if action is null or action not in ('complete-upload','publish','cleanup') then raise exception 'INVALID_REQUEST'; end if;
 perform public.take_operation(auth.uid(),'edge:'||action,
 case when action='complete-upload' then 600 when action='publish' then 10 else 3 end,
 case when action='publish' then 60 else 3600 end);
 return auth.uid();
end;
$$;
revoke execute on function public.authorize_edge_action(text) from public,anon;
grant execute on function public.authorize_edge_action(text) to authenticated,service_role;

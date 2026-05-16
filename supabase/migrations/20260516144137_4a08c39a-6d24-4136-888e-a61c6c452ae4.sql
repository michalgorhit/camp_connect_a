grant usage on schema private to authenticated;
grant execute on function private.can_view_shared_kid(uuid, uuid, text) to authenticated;
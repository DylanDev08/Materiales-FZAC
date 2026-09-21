revoke update on table public.notifications from authenticated;
grant update (read, read_at) on table public.notifications to authenticated;

create or replace function public.protect_notification_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.request_is_service_role() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.target_role is distinct from old.target_role
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.link_to is distinct from old.link_to
    or new.created_at is distinct from old.created_at then
    raise exception 'NOTIFICATION_CONTENT_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_notification_content on public.notifications;
create trigger protect_notification_content
before update on public.notifications
for each row execute function public.protect_notification_content();

revoke all on function public.protect_notification_content() from public, anon, authenticated;
grant execute on function public.protect_notification_content() to service_role;

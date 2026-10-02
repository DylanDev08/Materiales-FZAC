create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists admin_push_subscriptions_user_active_idx
  on public.admin_push_subscriptions(user_id, active);

alter table public.admin_push_subscriptions enable row level security;

drop policy if exists "admins_manage_push_subscriptions" on public.admin_push_subscriptions;
create policy "admins_manage_push_subscriptions"
on public.admin_push_subscriptions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on table public.admin_push_subscriptions from anon;
grant select, insert, update, delete on table public.admin_push_subscriptions to authenticated;
grant all on table public.admin_push_subscriptions to service_role;

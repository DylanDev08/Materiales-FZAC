-- Reduce direct exposure of sensitive payment data.
-- Account and receipt flows read payment summaries server-side through service_role.
revoke select on table public.payments from authenticated;

-- Sensitive/internal operational rows are not required by the current browser Realtime flows.
alter publication supabase_realtime drop table public.payments;
alter publication supabase_realtime drop table public.inventory_movements;

-- Match the admin notification query pattern: target role + newest first.
create index if not exists notifications_target_role_created_at_idx
  on public.notifications (target_role, created_at desc);

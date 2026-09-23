-- Remove direct authenticated reads from the sensitive payments base table.
-- Account/receipt flows read payment summaries server-side through service_role.
revoke select on table public.payments from authenticated;

-- Stop broadcasting sensitive/internal operational rows through Supabase Realtime.
alter publication supabase_realtime drop table public.payments;
alter publication supabase_realtime drop table public.inventory_movements;

-- Match the real admin notification access pattern: target_role filter + newest first.
create index if not exists notifications_target_role_created_at_idx
  on public.notifications (target_role, created_at desc);;\n
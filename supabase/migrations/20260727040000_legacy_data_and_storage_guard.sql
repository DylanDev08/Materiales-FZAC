-- Isolate unused Prisma-era tables that retain password/token material.
-- Records are preserved for a later, explicitly approved retention cleanup.

begin;

revoke all on table public.users from anon, authenticated;
revoke all on table public."Notification" from anon, authenticated;
revoke all on table public."AuditLog" from anon, authenticated;
revoke all on table public._prisma_migrations from anon, authenticated;

grant all on table public.users to service_role;
grant all on table public."Notification" to service_role;
grant all on table public."AuditLog" to service_role;
grant all on table public._prisma_migrations to service_role;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'product-images';

commit;

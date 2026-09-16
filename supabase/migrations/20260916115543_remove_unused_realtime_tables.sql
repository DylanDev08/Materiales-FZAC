-- The storefront and admin notification bell use HTTP reads/polling. There are
-- no Realtime consumers for these tables, so publishing their full change feed
-- only expands the replication surface. Keep chat and orders unchanged.
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime drop table public.notifications;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime drop table public.products;
  end if;
end
$$;

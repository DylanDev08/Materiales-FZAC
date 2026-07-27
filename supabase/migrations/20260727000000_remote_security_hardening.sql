-- Remote hardening discovered by the Supabase security advisor.
-- This migration is additive: it does not delete business records or relax RLS.

begin;

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

-- This legacy helper exists on the hosted project but not on clean installs.
do $$
begin
  if to_regprocedure('public.generate_ticket_number()') is not null then
    execute 'alter function public.generate_ticket_number() set search_path = public';
    execute 'revoke execute on function public.generate_ticket_number() from public, anon, authenticated';
    execute 'grant execute on function public.generate_ticket_number() to service_role';
  end if;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke execute on function public.finalize_paid_order(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.finalize_paid_order(uuid, text, jsonb)
to service_role;

-- Public catalog reads do not need to call the SECURITY DEFINER admin helper.
drop policy if exists "public active categories" on public.categories;
drop policy if exists "categories_public_read_active" on public.categories;
create policy "categories_public_read_active"
on public.categories
for select
to anon, authenticated
using (active = true);

drop policy if exists "public active products" on public.products;
drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active"
on public.products
for select
to anon, authenticated
using (active = true);

drop policy if exists "reviews public approved" on public.reviews;
drop policy if exists "reviews_public_read_approved" on public.reviews;
create policy "reviews_public_read_approved"
on public.reviews
for select
to anon, authenticated
using (approved = true or user_id = (select auth.uid()));

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Product view analytics are not written by the application. Keeping a public
-- WITH CHECK (true) path would allow unbounded direct writes around API limits.
drop policy if exists "product views insert" on public.product_views;
drop policy if exists "product_views insert" on public.product_views;
drop policy if exists "product_views_public_insert" on public.product_views;
revoke insert on public.product_views from anon, authenticated;

create index if not exists orders_admin_approval_idx
on public.orders(status, created_at desc)
where status = 'PENDING_ADMIN_APPROVAL';

update public.products
set image_url = '',
    updated_at = now()
where image_url ilike '%google.com/clavos%';

commit;

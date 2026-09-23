-- Allow the public storefront to sort active catalog entries by creation date
-- without exposing supplier/internal product columns.
grant select (created_at) on table public.products to anon, authenticated;

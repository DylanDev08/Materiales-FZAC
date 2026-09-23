
revoke select on table public.purchase_tickets from authenticated;
grant select (
  id,
  number,
  order_id,
  customer_name,
  customer_email,
  customer_phone,
  payment_provider,
  subtotal,
  discount,
  shipping_cost,
  total,
  shipping_method,
  address_snapshot,
  notes,
  status,
  issued_at,
  created_at,
  updated_at
) on table public.purchase_tickets to authenticated;

revoke select on table public.purchase_ticket_items from authenticated;
grant select (
  id,
  ticket_id,
  product_id,
  sku,
  name,
  quantity,
  unit_price,
  subtotal,
  created_at
) on table public.purchase_ticket_items to authenticated;
;\n
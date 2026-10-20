begin;

update public.products p
set stock = im.stock_before,
    updated_at = now()
from public.inventory_movements im
join public.orders o on o.id = im.order_id
where p.id = im.product_id
  and im.type = 'SALE'
  and p.stock = im.stock_after;

delete from public.financial_movements fm
where fm.source = 'PURCHASE_PAYMENT'
  and (
    fm.source_reference in (select 'order:' || id::text from public.orders)
    or fm.metadata->>'order_id' in (select id::text from public.orders)
  );

delete from public.inventory_movements
where order_id in (select id from public.orders);

delete from public.payment_events;

delete from public.orders;

commit;

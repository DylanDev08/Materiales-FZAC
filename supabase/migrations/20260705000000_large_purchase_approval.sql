alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'PENDING_PAYMENT',
      'PENDING_ADMIN_APPROVAL',
      'PAID',
      'CONFIRMED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED'
    )
  );

create index if not exists orders_admin_approval_idx
  on public.orders(status, created_at desc)
  where status = 'PENDING_ADMIN_APPROVAL';

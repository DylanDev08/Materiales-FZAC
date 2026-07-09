alter table public.payments
  drop constraint if exists payments_provider_check;

alter table public.payments
  add constraint payments_provider_check
  check (provider in ('MERCADOPAGO','BANK_TRANSFER','WHATSAPP','MOCK','NARANJAX'));

alter table public.payment_events
  drop constraint if exists payment_events_provider_check;

alter table public.payment_events
  add constraint payment_events_provider_check
  check (provider in ('MERCADOPAGO','BANK_TRANSFER','WHATSAPP','MOCK','NARANJAX'));

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'PENDING_PAYMENT',
      'PENDING_TRANSFER',
      'PENDING_ADMIN_APPROVAL',
      'COORDINATE',
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

create index if not exists orders_pending_transfer_idx
  on public.orders(status, created_at desc)
  where status = 'PENDING_TRANSFER';

create index if not exists orders_coordinate_idx
  on public.orders(status, created_at desc)
  where status = 'COORDINATE';

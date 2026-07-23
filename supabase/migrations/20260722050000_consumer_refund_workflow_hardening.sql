-- Harden the consumer refund workflow without changing existing requests.
-- Public submissions remain server-side only; administrators manage status
-- through protected Next.js routes.

alter table public.consumer_refund_requests
  add column if not exists idempotency_key text,
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create unique index if not exists consumer_refund_requests_idempotency_idx
  on public.consumer_refund_requests(idempotency_key)
  where idempotency_key is not null;

create index if not exists consumer_refund_requests_order_idx
  on public.consumer_refund_requests(order_id, created_at desc)
  where order_id is not null;


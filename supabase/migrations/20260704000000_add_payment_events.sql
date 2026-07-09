create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'MERCADOPAGO' check (provider in ('MERCADOPAGO','NARANJAX')),
  provider_event_id text,
  provider_payment_id text,
  order_id uuid references public.orders(id) on delete set null,
  event_type text not null default 'payment',
  status text not null default 'RECEIVED' check (status in ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  raw jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_events_provider_payment_idx on public.payment_events(provider, provider_payment_id);
create index if not exists payment_events_order_idx on public.payment_events(order_id, created_at desc);
create index if not exists payment_events_status_idx on public.payment_events(status, created_at desc);

alter table public.payment_events enable row level security;

drop policy if exists "admin payment events read" on public.payment_events;
drop policy if exists "admin payment events all" on public.payment_events;

create policy "admin payment events read" on public.payment_events
  for select using (public.is_admin());

create policy "admin payment events all" on public.payment_events
  for all using (public.is_admin()) with check (public.is_admin());

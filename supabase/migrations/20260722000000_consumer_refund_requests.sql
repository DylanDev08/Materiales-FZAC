-- Additive consumer-protection workflow for Boton de arrepentimiento.
-- This migration creates a private request table. Public submissions go through
-- the Next.js API using service_role; no public table access is opened.

create table if not exists public.consumer_refund_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  order_number text,
  full_name text not null,
  email text not null,
  phone text not null,
  reason text not null check (reason in (
    'PURCHASE_REGRET',
    'WRONG_PRODUCT',
    'DAMAGED_PRODUCT',
    'NOT_DELIVERED',
    'OTHER'
  )),
  details text not null,
  preferred_contact text not null default 'WHATSAPP' check (preferred_contact in ('WHATSAPP','EMAIL','PHONE')),
  status text not null default 'RECEIVED' check (status in ('RECEIVED','IN_REVIEW','APPROVED','REJECTED','CLOSED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consumer_refund_requests_status_idx
  on public.consumer_refund_requests(status, created_at desc);

create index if not exists consumer_refund_requests_user_idx
  on public.consumer_refund_requests(user_id, created_at desc);

alter table public.consumer_refund_requests enable row level security;

drop policy if exists "consumer_refund_requests_admin_all" on public.consumer_refund_requests;
create policy "consumer_refund_requests_admin_all"
on public.consumer_refund_requests
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "consumer_refund_requests_user_read_own" on public.consumer_refund_requests;
create policy "consumer_refund_requests_user_read_own"
on public.consumer_refund_requests
for select
to authenticated
using (user_id = auth.uid());

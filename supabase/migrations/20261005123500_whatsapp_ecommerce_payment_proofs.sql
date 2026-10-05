create table if not exists public.whatsapp_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  external_message_id text not null unique,
  media_id text not null,
  mime_type text,
  filename text,
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW','ACCEPTED','REJECTED')),
  customer_phone_last4 text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create index if not exists whatsapp_payment_proofs_order_status_idx
  on public.whatsapp_payment_proofs(order_id, status, created_at desc);

alter table public.whatsapp_payment_proofs enable row level security;
alter table public.whatsapp_payment_proofs force row level security;
revoke all on table public.whatsapp_payment_proofs from anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_payment_proofs to service_role;

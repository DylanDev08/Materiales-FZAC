-- Supervised quality inbox for the FZAC assistant.
-- Additive only: the assistant never publishes knowledge from this table.

begin;

create table if not exists public.assistant_review_queue (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_message_id uuid references public.chat_messages(id) on delete cascade,
  assistant_message_id uuid not null references public.chat_messages(id) on delete cascade,
  knowledge_slug text,
  intent text not null check (intent in (
    'greeting', 'delivery', 'payment', 'stock', 'price', 'estimate',
    'order_status', 'returns', 'store_policy', 'human', 'product_search', 'fallback'
  )),
  reason text not null check (reason in ('NEGATIVE_FEEDBACK', 'LOW_CONFIDENCE', 'UNRESOLVED', 'HANDOFF')),
  confidence numeric(6,5) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  priority smallint not null default 2 check (priority between 1 and 4),
  status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED')),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  review_notes text check (review_notes is null or char_length(review_notes) <= 800),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assistant_message_id, reason)
);

create index if not exists assistant_review_queue_status_priority_idx
on public.assistant_review_queue (status, priority desc, last_seen_at desc);

create index if not exists assistant_review_queue_conversation_idx
on public.assistant_review_queue (conversation_id, last_seen_at desc);

drop trigger if exists set_assistant_review_queue_updated_at on public.assistant_review_queue;
create trigger set_assistant_review_queue_updated_at
before update on public.assistant_review_queue
for each row execute function public.set_updated_at();

alter table public.assistant_review_queue enable row level security;
alter table public.assistant_review_queue force row level security;

drop policy if exists "admin assistant review queue read" on public.assistant_review_queue;
create policy "admin assistant review queue read"
on public.assistant_review_queue for select to authenticated
using (public.is_admin());

revoke all on table public.assistant_review_queue from anon, authenticated;
grant select on table public.assistant_review_queue to authenticated;
grant all on table public.assistant_review_queue to service_role;

comment on table public.assistant_review_queue is
  'Private supervised quality signals. Entries require human review and never publish assistant knowledge automatically.';

commit;

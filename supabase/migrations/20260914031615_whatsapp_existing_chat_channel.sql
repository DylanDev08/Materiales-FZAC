-- Extends the existing assistant conversation ledger for WhatsApp Cloud API.
-- The full phone number is never stored; only a keyed hash and the last four digits.

begin;

alter table public.chat_conversations
  drop constraint if exists chat_conversations_channel_check;

alter table public.chat_conversations
  add constraint chat_conversations_channel_check
  check (channel in ('AI', 'SUPPORT', 'WHATSAPP'));

alter table public.chat_conversations
  add column if not exists phone_hash text,
  add column if not exists phone_last4 text;

alter table public.chat_conversations
  drop constraint if exists chat_conversations_phone_hash_check,
  drop constraint if exists chat_conversations_phone_last4_check;

alter table public.chat_conversations
  add constraint chat_conversations_phone_hash_check
    check (phone_hash is null or phone_hash ~ '^[0-9a-f]{64}$'),
  add constraint chat_conversations_phone_last4_check
    check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$');

create index if not exists chat_conversations_whatsapp_phone_idx
  on public.chat_conversations(phone_hash, updated_at desc)
  where channel = 'WHATSAPP' and phone_hash is not null;

create unique index if not exists chat_conversations_whatsapp_open_unique
  on public.chat_conversations(phone_hash)
  where channel = 'WHATSAPP' and phone_hash is not null and status <> 'CLOSED';

alter table public.chat_messages
  add column if not exists external_message_id text,
  add column if not exists direction text,
  add column if not exists message_type text;

alter table public.chat_messages
  drop constraint if exists chat_messages_external_message_id_check,
  drop constraint if exists chat_messages_direction_check,
  drop constraint if exists chat_messages_message_type_check;

alter table public.chat_messages
  add constraint chat_messages_external_message_id_check
    check (external_message_id is null or char_length(external_message_id) between 8 and 180),
  add constraint chat_messages_direction_check
    check (direction is null or direction in ('INBOUND', 'OUTBOUND')),
  add constraint chat_messages_message_type_check
    check (message_type is null or message_type in ('TEXT', 'BUTTON', 'INTERACTIVE', 'UNSUPPORTED'));

create unique index if not exists chat_messages_external_message_id_unique
  on public.chat_messages(external_message_id)
  where external_message_id is not null;

comment on column public.chat_conversations.phone_hash is
  'Keyed SHA-256 hash used to correlate WhatsApp conversations without storing the full phone number.';
comment on column public.chat_conversations.phone_last4 is
  'Last four digits for administrative identification; never sufficient for authentication.';
comment on column public.chat_messages.external_message_id is
  'Unique provider message id used for idempotent webhook processing.';

alter table public.chat_conversations enable row level security;
alter table public.chat_conversations force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;

-- Writes stay server-side. Existing owner/admin policies keep WhatsApp rows private
-- because they have no user_id and use a server-only visitor identifier.
revoke insert, update, delete on table public.chat_conversations from anon, authenticated;
revoke insert, update, delete on table public.chat_messages from anon, authenticated;

commit;

;\n
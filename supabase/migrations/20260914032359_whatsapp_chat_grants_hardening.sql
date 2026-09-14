-- Removes legacy table-level privileges that are unnecessary for browser clients.
-- Authenticated users retain owner-scoped reads through existing RLS policies;
-- all conversation writes are performed by validated server routes.

begin;

revoke all on table public.chat_conversations from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;

grant select on table public.chat_conversations to authenticated;
grant select on table public.chat_messages to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_conversations force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;

commit;

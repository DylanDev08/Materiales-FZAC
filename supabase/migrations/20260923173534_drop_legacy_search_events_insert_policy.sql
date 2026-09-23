
drop policy if exists "search events owner insert" on public.search_events;

revoke all privileges on table public.search_events from anon;
revoke insert, update, delete, truncate, references, trigger on table public.search_events from authenticated;
grant select on table public.search_events to authenticated;
;\n
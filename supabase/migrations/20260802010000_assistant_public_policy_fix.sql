-- Keep public knowledge reads independent from the privileged is_admin helper.

begin;

drop policy if exists "public active assistant knowledge" on public.assistant_knowledge;
create policy "public active assistant knowledge"
on public.assistant_knowledge for select
to anon, authenticated
using (active = true);

commit;

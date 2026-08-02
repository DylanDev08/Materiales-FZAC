-- Prevent anonymous reads from evaluating privileged admin-only predicates.

begin;

drop policy if exists "admin assistant knowledge all" on public.assistant_knowledge;
create policy "admin assistant knowledge all"
on public.assistant_knowledge for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin assistant knowledge versions read" on public.assistant_knowledge_versions;
create policy "admin assistant knowledge versions read"
on public.assistant_knowledge_versions for select
to authenticated
using (public.is_admin());

drop policy if exists "admin assistant feedback read" on public.assistant_feedback;
create policy "admin assistant feedback read"
on public.assistant_feedback for select
to authenticated
using (public.is_admin());

commit;

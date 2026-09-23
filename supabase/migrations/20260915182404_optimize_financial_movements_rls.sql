alter policy "admin financial movements insert"
on public.financial_movements
to authenticated
with check (
  (select public.is_admin())
  and created_by = (select auth.uid())
  and status = 'ACTIVE'::text
  and source = any (array['MANUAL'::text, 'ADJUSTMENT'::text])
  and source_reference is null
);

alter policy "admin financial movements read"
on public.financial_movements
to authenticated
using ((select public.is_admin()));

alter policy "admin financial movements update"
on public.financial_movements
to authenticated
using (
  (select public.is_admin())
  and source = any (array['MANUAL'::text, 'ADJUSTMENT'::text])
)
with check (
  (select public.is_admin())
  and source = any (array['MANUAL'::text, 'ADJUSTMENT'::text])
  and status = 'VOID'::text
  and voided_by = (select auth.uid())
);;\n
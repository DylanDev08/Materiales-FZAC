-- Evaluate auth.uid() once per statement instead of once per row.
-- Policy names and permissions remain unchanged.

begin;

do $$
declare
  v_policy record;
  v_using text;
  v_check text;
  v_statement text;
begin
  for v_policy in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    v_using := replace(
      replace(
        replace(coalesce(v_policy.qual, ''), '(select auth.uid())', '__FZAC_AUTH_UID__'),
        'auth.uid()',
        '(select auth.uid())'
      ),
      '__FZAC_AUTH_UID__',
      '(select auth.uid())'
    );

    v_check := replace(
      replace(
        replace(coalesce(v_policy.with_check, ''), '(select auth.uid())', '__FZAC_AUTH_UID__'),
        'auth.uid()',
        '(select auth.uid())'
      ),
      '__FZAC_AUTH_UID__',
      '(select auth.uid())'
    );

    v_statement := format(
      'alter policy %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );

    if v_policy.qual is not null then
      v_statement := v_statement || ' using (' || v_using || ')';
    end if;

    if v_policy.with_check is not null then
      v_statement := v_statement || ' with check (' || v_check || ')';
    end if;

    execute v_statement;
  end loop;
end
$$;

-- Keep the migration-owned unique index and remove the identical legacy copy.
drop index if exists public.idx_payment_events_provider_event_id;

commit;

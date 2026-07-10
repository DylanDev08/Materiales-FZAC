do $$
begin
  if exists (
    select 1
    from public.payments
    where provider_session_id is not null
    group by provider_session_id
    having count(*) > 1
  ) then
    raise notice 'TODO(prod-db): provider_session_id tiene duplicados existentes; limpiar duplicados antes de crear payments_provider_session_unique_idx.';
  else
    execute '
      create unique index if not exists payments_provider_session_unique_idx
      on public.payments(provider_session_id)
      where provider_session_id is not null
    ';
  end if;
end $$;

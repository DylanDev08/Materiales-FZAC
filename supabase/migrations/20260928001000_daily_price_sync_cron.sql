begin;

-- El secreto del cron se guarda exclusivamente en Supabase Vault.
-- Esta migración nunca contiene ni versiona el valor secreto.

create or replace function public.run_fzac_daily_price_sync()
returns bigint
language plpgsql
security definer
set search_path to public, net, vault, pg_catalog
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select public.get_market_price_cron_secret() into v_secret;
  if v_secret is null or length(v_secret) < 20 then
    raise exception 'MARKET_PRICE_CRON_SECRET_NOT_CONFIGURED';
  end if;

  select net.http_get(
    url := 'https://materiales-fzac.onrender.com/api/cron/market-prices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'User-Agent', 'FZAC-Supabase-Cron/1.0'
    ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.run_fzac_daily_price_sync() from public, anon, authenticated;
grant execute on function public.run_fzac_daily_price_sync() to service_role;

do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname='fzac-daily-market-price-sync'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

select cron.schedule(
  'fzac-daily-market-price-sync',
  '0 12 * * *',
  $$select public.run_fzac_daily_price_sync();$$
);

commit;

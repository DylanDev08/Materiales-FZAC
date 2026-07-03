alter table public.payments
  drop constraint if exists payments_provider_check;

update public.payments
set provider = 'MERCADOPAGO'
where provider = 'MOCK';

alter table public.payments
  add constraint payments_provider_check
  check (provider in ('MERCADOPAGO','NARANJAX'));

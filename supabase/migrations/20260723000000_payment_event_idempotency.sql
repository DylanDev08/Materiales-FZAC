-- Prevent the same Mercado Pago notification from being recorded more than once.
-- Legacy IPN events without a stable notification id keep provider_event_id null.

create unique index if not exists payment_events_provider_event_unique_idx
  on public.payment_events(provider, provider_event_id)
  where provider_event_id is not null;

begin;

create or replace function public.finalize_failed_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_raw jsonb,
  p_payment_status text,
  p_provider_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_now timestamptz := now();
  v_released integer := 0;
begin
  if p_payment_status not in ('FAILED','EXPIRED') then
    raise exception 'INVALID_PAYMENT_STATUS';
  end if;

  select * into v_payment
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.provider <> 'MERCADOPAGO' then raise exception 'PAYMENT_PROVIDER_MISMATCH'; end if;
  if v_payment.status in ('PAID','REFUNDED') then raise exception 'PAYMENT_ALREADY_FINALIZED'; end if;

  if v_payment.provider_payment_id is not null
     and p_provider_payment_id is not null
     and v_payment.provider_payment_id <> p_provider_payment_id then
    raise exception 'PROVIDER_PAYMENT_ID_MISMATCH';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('PAID','CONFIRMED','PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED','COMPLETED') then
    raise exception 'ORDER_ALREADY_FINALIZED';
  end if;

  update public.payments
  set status = p_payment_status,
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      raw = coalesce(raw, '{}'::jsonb)
        || coalesce(p_raw, '{}'::jsonb)
        || jsonb_build_object('provider_status', coalesce(p_provider_status,'')),
      updated_at = v_now
  where id = v_payment.id;

  update public.stock_reservations
  set status = 'RELEASED',
      release_reason = 'MERCADOPAGO_' || p_payment_status,
      released_at = coalesce(released_at, v_now),
      updated_at = v_now
  where order_id = p_order_id
    and status = 'ACTIVE';

  get diagnostics v_released = row_count;

  update public.orders
  set status = 'CANCELLED',
      cancellation_reason = 'Mercado Pago: ' || coalesce(nullif(p_provider_status,''), p_payment_status),
      cancelled_at = coalesce(cancelled_at, v_now),
      updated_at = v_now
  where id = p_order_id
    and status in ('PENDING_PAYMENT','PENDING_TRANSFER','COORDINATE');

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'payment_status', p_payment_status,
    'released_reservations', v_released
  );
end;
$$;

revoke all on function public.finalize_failed_order(uuid,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.finalize_failed_order(uuid,text,jsonb,text,text) to service_role;

commit;

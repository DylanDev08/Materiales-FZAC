with target as (
  select o.id
  from public.orders o
  join public.payments p on p.order_id = o.id
  where o.status = 'PENDING_PAYMENT'
    and o.created_at < now() - interval '30 days'
    and p.provider = 'MERCADOPAGO'
    and p.status = 'PENDING'
    and p.provider_payment_id is null
    and not exists (
      select 1 from public.order_items oi where oi.order_id = o.id
    )
),
expired_payments as (
  update public.payments p
  set status = 'EXPIRED',
      raw = coalesce(p.raw, '{}'::jsonb) || jsonb_build_object(
        'internal_cleanup_reason', 'LEGACY_EMPTY_ORDER',
        'internal_cleanup_at', now()
      ),
      updated_at = now()
  where p.order_id in (select id from target)
    and p.status = 'PENDING'
  returning p.order_id
),
cancelled_orders as (
  update public.orders o
  set status = 'CANCELLED',
      updated_at = now()
  where o.id in (select id from target)
    and o.status = 'PENDING_PAYMENT'
  returning o.id
)
insert into public.admin_audit_logs (
  actor_id, actor_email, actor_role, action, entity, entity_id, message, metadata
)
select
  null,
  null,
  'SYSTEM',
  'LEGACY_EMPTY_CHECKOUTS_EXPIRED',
  'orders',
  null,
  'Se expiraron checkouts legacy pendientes sin items; no se eliminaron registros.',
  jsonb_build_object(
    'payments_expired', (select count(*) from expired_payments),
    'orders_cancelled', (select count(*) from cancelled_orders),
    'rule', 'PENDING_PAYMENT + MERCADOPAGO/PENDING + no provider_payment_id + no items + older than 30 days'
  )
where exists (select 1 from target);;\n
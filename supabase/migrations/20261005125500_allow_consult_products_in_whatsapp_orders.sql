create or replace function public.create_checkout_order(p_user_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text, p_shipping_method text, p_shipping_cost numeric, p_subtotal numeric, p_total numeric, p_address_snapshot jsonb, p_notes text, p_order_status text, p_payment_provider text, p_idempotency_key text, p_payment_raw jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order_id uuid;
  v_payment_id uuid;
  v_existing record;
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_quantity integer;
  v_requested_quantity integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_expected_line_total numeric(12,2);
  v_items_subtotal numeric(12,2) := 0;
  v_reserved_quantity integer;
  v_available_quantity integer;
  v_should_reserve boolean := false;
  v_reservation_expires_at timestamptz;
begin
  if not public.request_is_service_role() then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 120 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select p.id as payment_id,p.order_id,p.provider,p.status as payment_status,o.status as order_status,o.user_id,o.customer_email,
    (select max(sr.expires_at) from public.stock_reservations sr where sr.order_id=o.id and sr.status='ACTIVE' and sr.expires_at>now()) as reservation_expires_at
  into v_existing
  from public.payments p join public.orders o on o.id=p.order_id
  where p.provider_session_id=trim(p_idempotency_key)
  limit 1;

  if found then
    return jsonb_build_object('created',false,'order_id',v_existing.order_id,'payment_id',v_existing.payment_id,'order_status',v_existing.order_status,'payment_status',v_existing.payment_status,'provider',v_existing.provider,'user_id',v_existing.user_id,'customer_email',v_existing.customer_email,'reservation_expires_at',v_existing.reservation_expires_at);
  end if;

  if p_shipping_method not in ('PICKUP','DELIVERY') then raise exception 'INVALID_SHIPPING_METHOD'; end if;
  if p_order_status not in ('PENDING_PAYMENT','PENDING_TRANSFER','PENDING_ADMIN_APPROVAL','COORDINATE') then raise exception 'INVALID_ORDER_STATUS'; end if;
  if p_payment_provider not in ('MERCADOPAGO','BANK_TRANSFER','WHATSAPP','NARANJAX') then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;
  if p_subtotal < 0 or p_shipping_cost < 0 or p_total <= 0 or abs(p_total-(p_subtotal+p_shipping_cost)) > 0.01 then raise exception 'INVALID_ORDER_TOTAL'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then raise exception 'INVALID_ORDER_ITEMS'; end if;

  v_should_reserve := p_payment_provider='MERCADOPAGO' and p_order_status='PENDING_PAYMENT';

  update public.stock_reservations set status='EXPIRED',released_at=coalesce(released_at,now()),release_reason=coalesce(release_reason,'TTL_EXPIRED'),updated_at=now() where status='ACTIVE' and expires_at<=now();

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      v_unit_price := (v_item->>'unit_price')::numeric;
      v_line_total := (v_item->>'line_total')::numeric;
    exception when others then raise exception 'INVALID_ORDER_ITEM'; end;

    if v_quantity < 1 or v_quantity > 999 or v_unit_price <= 0 or v_line_total < 0 then raise exception 'INVALID_ORDER_ITEM'; end if;

    select id,sku,name,price,stock,active,availability_status,promotion_type,promotion_discount_percent
    into v_product from public.products where id=v_product_id for update;

    if not found or not v_product.active or v_product.availability_status='OUT_OF_STOCK' then raise exception 'PRODUCT_NOT_AVAILABLE:%',v_product_id; end if;

    select sum((candidate->>'quantity')::integer) into v_requested_quantity from jsonb_array_elements(p_items) candidate where candidate->>'product_id'=v_product_id::text;

    if v_product.availability_status <> 'CONSULT' then
      select coalesce(sum(sr.quantity),0)::integer into v_reserved_quantity from public.stock_reservations sr where sr.product_id=v_product_id and sr.status='ACTIVE' and sr.expires_at>now();
      v_available_quantity := greatest(v_product.stock-v_reserved_quantity,0);
      if v_available_quantity < v_requested_quantity then raise exception 'INSUFFICIENT_STOCK:%:%',v_product_id,v_available_quantity; end if;
    end if;

    if abs(v_product.price-v_unit_price) > 0.01 then raise exception 'PRICE_CHANGED:%',v_product_id; end if;
    v_expected_line_total := public.fzac_product_line_total(v_product.price,v_product.promotion_type,v_product.promotion_discount_percent,v_quantity);
    if abs(v_expected_line_total-v_line_total) > 0.01 then raise exception 'PRICE_CHANGED:%',v_product_id; end if;
    v_items_subtotal := v_items_subtotal+v_line_total;
  end loop;

  if abs(v_items_subtotal-p_subtotal) > 0.01 then raise exception 'INVALID_ITEMS_SUBTOTAL'; end if;

  begin
    insert into public.orders(user_id,status,customer_name,customer_email,customer_phone,shipping_method,shipping_cost,subtotal,total,address_snapshot,notes)
    values(p_user_id,p_order_status,trim(p_customer_name),lower(trim(p_customer_email)),trim(p_customer_phone),p_shipping_method,p_shipping_cost,p_subtotal,p_total,p_address_snapshot,nullif(trim(p_notes),'')) returning id into v_order_id;

    for v_item in select value from jsonb_array_elements(p_items)
    loop
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      v_unit_price := (v_item->>'unit_price')::numeric;
      v_line_total := (v_item->>'line_total')::numeric;
      select sku,name into v_product from public.products where id=v_product_id;
      insert into public.order_items(order_id,product_id,sku,name,image_url,quantity,unit_price,subtotal)
      values(v_order_id,v_product_id,v_product.sku,v_product.name,coalesce(v_item->>'image_url',''),v_quantity,v_unit_price,v_line_total);
    end loop;

    insert into public.payments(order_id,provider,status,amount,currency,provider_session_id,raw)
    values(v_order_id,p_payment_provider,'PENDING',p_total,'ars',trim(p_idempotency_key),coalesce(p_payment_raw,'{}'::jsonb)) returning id into v_payment_id;

    if v_should_reserve then
      v_reservation_expires_at := now()+interval '30 minutes';
      insert into public.stock_reservations(order_id,product_id,quantity,status,expires_at,updated_at)
      select v_order_id,oi.product_id,sum(oi.quantity)::integer,'ACTIVE',v_reservation_expires_at,now()
      from public.order_items oi join public.products p on p.id=oi.product_id
      where oi.order_id=v_order_id and p.availability_status='IN_STOCK'
      group by oi.product_id;
    end if;
  exception when unique_violation then
    select p.id as payment_id,p.order_id,p.provider,p.status as payment_status,o.status as order_status,o.user_id,o.customer_email,
      (select max(sr.expires_at) from public.stock_reservations sr where sr.order_id=o.id and sr.status='ACTIVE' and sr.expires_at>now()) as reservation_expires_at
    into v_existing from public.payments p join public.orders o on o.id=p.order_id where p.provider_session_id=trim(p_idempotency_key) limit 1;
    if not found then raise; end if;
    return jsonb_build_object('created',false,'order_id',v_existing.order_id,'payment_id',v_existing.payment_id,'order_status',v_existing.order_status,'payment_status',v_existing.payment_status,'provider',v_existing.provider,'user_id',v_existing.user_id,'customer_email',v_existing.customer_email,'reservation_expires_at',v_existing.reservation_expires_at);
  end;

  return jsonb_build_object('created',true,'order_id',v_order_id,'payment_id',v_payment_id,'order_status',p_order_status,'payment_status','PENDING','provider',p_payment_provider,'user_id',p_user_id,'customer_email',lower(trim(p_customer_email)),'reservation_expires_at',v_reservation_expires_at);
end;
$function$;

create or replace function public.finalize_paid_order(p_order_id uuid, p_provider_payment_id text default null::text, p_raw jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_ticket_id uuid;
  v_ticket_number text;
  v_insufficient_product text;
begin
  if not public.request_is_service_role() then raise exception 'SERVICE_ROLE_REQUIRED'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into v_payment from public.payments where order_id=p_order_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if v_order.status in ('PAID','CONFIRMED','PREPARING','READY_FOR_PICKUP','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED','COMPLETED') then
    update public.stock_reservations set status='CONSUMED',consumed_at=coalesce(consumed_at,now()),updated_at=now() where order_id=p_order_id and status='ACTIVE';
    return jsonb_build_object('ok',true,'already_processed',true,'order_id',p_order_id);
  end if;
  if v_order.status='CANCELLED' then raise exception 'ORDER_CANCELLED'; end if;
  if v_payment.status not in ('PENDING','PAID') then raise exception 'PAYMENT_STATUS_NOT_CONFIRMABLE'; end if;

  perform 1 from public.products p join public.order_items oi on oi.product_id=p.id where oi.order_id=p_order_id order by p.id for update of p;

  select p.name into v_insufficient_product
  from public.order_items oi join public.products p on p.id=oi.product_id
  where oi.order_id=p_order_id
    and p.availability_status='IN_STOCK'
    and (p.stock-coalesce((select sum(sr.quantity) from public.stock_reservations sr where sr.product_id=p.id and sr.order_id<>p_order_id and sr.status='ACTIVE' and sr.expires_at>now()),0)) < oi.quantity
  limit 1;
  if v_insufficient_product is not null then raise exception 'INSUFFICIENT_AVAILABLE_STOCK:%',v_insufficient_product; end if;

  insert into public.inventory_movements(product_id,order_id,type,quantity,stock_before,stock_after,reason,metadata,created_at)
  select p.id,p_order_id,'SALE',-oi.quantity,p.stock,p.stock-oi.quantity,'Venta confirmada',jsonb_build_object('provider',v_payment.provider,'provider_payment_id',p_provider_payment_id,'stock_reservation',true),now()
  from public.order_items oi join public.products p on p.id=oi.product_id
  where oi.order_id=p_order_id and p.availability_status='IN_STOCK';

  update public.products p set stock=p.stock-oi.quantity,updated_at=now()
  from public.order_items oi
  where oi.order_id=p_order_id and oi.product_id=p.id and p.availability_status='IN_STOCK';

  update public.stock_reservations set status='CONSUMED',consumed_at=now(),updated_at=now() where order_id=p_order_id and status in ('ACTIVE','EXPIRED','RELEASED');
  update public.payments set status='PAID',provider_payment_id=coalesce(p_provider_payment_id,provider_payment_id),raw=coalesce(raw,'{}'::jsonb)||coalesce(p_raw,'{}'::jsonb),updated_at=now() where order_id=p_order_id;
  update public.orders set status='PAID',paid_at=now(),updated_at=now() where id=p_order_id;

  select id into v_ticket_id from public.purchase_tickets where order_id=p_order_id limit 1;
  if v_ticket_id is null then
    v_ticket_number := public.generate_ticket_number();
    insert into public.purchase_tickets(number,order_id,customer_name,customer_email,customer_phone,payment_provider,payment_id,subtotal,discount,shipping_cost,total,shipping_method,address_snapshot,notes,status,issued_at)
    values(v_ticket_number,p_order_id,v_order.customer_name,v_order.customer_email,v_order.customer_phone,v_payment.provider,p_provider_payment_id,v_order.subtotal,0,v_order.shipping_cost,v_order.total,v_order.shipping_method,v_order.address_snapshot,v_order.notes,'ISSUED',now()) returning id into v_ticket_id;
    insert into public.purchase_ticket_items(ticket_id,product_id,sku,name,quantity,unit_price,subtotal,created_at)
    select v_ticket_id,product_id,sku,name,quantity,unit_price,subtotal,now() from public.order_items where order_id=p_order_id;
  end if;

  insert into public.notifications(user_id,target_role,type,title,message,link_to,read,created_at)
  values(null,'ADMIN','ORDER_PAID','Nuevo pedido pagado','Se confirmó un pago para la orden '||p_order_id::text,'/admin/orders/'||p_order_id::text,false,now());

  return jsonb_build_object('ok',true,'already_processed',false,'order_id',p_order_id,'ticket_id',v_ticket_id);
end;
$function$;

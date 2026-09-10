\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_admin_id uuid := '10000000-0000-4000-8000-000000000001';
  v_user_id uuid := '10000000-0000-4000-8000-000000000002';
  v_product_id uuid;
  v_product_price numeric(12,2);
  v_result jsonb;
  v_replay jsonb;
  v_order_id uuid;
  v_payment_id uuid;
  v_approval_order_id uuid;
  v_notification_id uuid;
  v_review_id uuid;
  v_category_id uuid;
  v_original_notes text := 'Entregar por la tarde';
  v_items jsonb;
  v_count integer;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_admin_id, 'db-admin@fzac.test', '{"full_name":"DB Admin"}'::jsonb),
    (v_user_id, 'db-user@fzac.test', '{"full_name":"DB User"}'::jsonb);

  update public.profiles set role = 'ADMIN' where id = v_admin_id;

  select id, price into v_product_id, v_product_price
  from public.products
  where active = true and stock > 1
  order by created_at
  limit 1;

  if v_product_id is null then
    raise exception 'ASSERTION_FAILED: active product fixture is missing';
  end if;

  v_items := jsonb_build_array(jsonb_build_object(
    'product_id', v_product_id,
    'quantity', 1,
    'unit_price', v_product_price,
    'image_url', ''
  ));

  v_result := public.create_checkout_order(
    v_user_id,
    'Cliente de prueba',
    'db-user@fzac.test',
    '3411234567',
    'PICKUP',
    0,
    v_product_price,
    v_product_price,
    null,
    v_original_notes,
    'PENDING_TRANSFER',
    'BANK_TRANSFER',
    'fzac-db-integrity-smoke-001',
    '{}'::jsonb,
    v_items
  );

  if not coalesce((v_result ->> 'created')::boolean, false) then
    raise exception 'ASSERTION_FAILED: checkout was not created';
  end if;

  v_order_id := (v_result ->> 'order_id')::uuid;
  v_payment_id := (v_result ->> 'payment_id')::uuid;

  v_replay := public.create_checkout_order(
    v_user_id,
    'Cliente de prueba',
    'db-user@fzac.test',
    '3411234567',
    'PICKUP',
    0,
    v_product_price,
    v_product_price,
    null,
    v_original_notes,
    'PENDING_TRANSFER',
    'BANK_TRANSFER',
    'fzac-db-integrity-smoke-001',
    '{}'::jsonb,
    v_items
  );

  if coalesce((v_replay ->> 'created')::boolean, true)
    or (v_replay ->> 'order_id')::uuid <> v_order_id
    or (v_replay ->> 'payment_id')::uuid <> v_payment_id then
    raise exception 'ASSERTION_FAILED: checkout idempotency did not reuse the order and payment';
  end if;

  begin
    update public.orders set user_id = v_admin_id where id = v_order_id;
    raise exception 'ASSERTION_FAILED: order ownership mismatch was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('ORDER_CUSTOMER_MISMATCH' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    update public.payments set amount = amount + 1 where id = v_payment_id;
    raise exception 'ASSERTION_FAILED: payment/order amount mismatch was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('PAYMENT_ORDER_AMOUNT_MISMATCH' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    insert into public.store_settings (key, value, public)
    values ('mercadopago_access_token', '"must-not-be-public"'::jsonb, true);
    raise exception 'ASSERTION_FAILED: sensitive public setting was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('SENSITIVE_STORE_SETTING_CANNOT_BE_PUBLIC' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    insert into public.suppliers (code, name, created_by, updated_by)
    values ('DB-USER-ACTOR', 'Proveedor invalido', v_user_id, v_user_id);
    raise exception 'ASSERTION_FAILED: non-admin operational actor was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('ADMIN_ACTOR_REQUIRED' in sqlerrm) = 0 then raise; end if;
  end;

  insert into public.suppliers (code, name, created_by, updated_by)
  values ('DB-ADMIN-ACTOR', 'Proveedor valido', v_admin_id, v_admin_id);

  insert into public.categories (name, slug, description)
  values ('Categoria prueba', 'categoria-prueba-db', 'Categoria temporal')
  returning id into v_category_id;
  begin
    update public.categories set parent_id = v_category_id where id = v_category_id;
    raise exception 'ASSERTION_FAILED: category cycle was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('CATEGORY_CYCLE' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    update public.products set image_url = 'http://insecure.example/product.jpg' where id = v_product_id;
    raise exception 'ASSERTION_FAILED: insecure product image URL was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('INVALID_PRODUCT_IMAGE' in sqlerrm) = 0 then raise; end if;
  end;

  update public.products
  set gallery = jsonb_build_array('https://example.com/producto-valido.jpg')
  where id = v_product_id;
  begin
    update public.products
    set gallery = jsonb_build_array('javascript:alert(1)')
    where id = v_product_id;
    raise exception 'ASSERTION_FAILED: insecure product gallery URL was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('INVALID_PRODUCT_GALLERY_IMAGE' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    update public.profiles set phone = 'codigo3411234567' where id = v_user_id;
    raise exception 'ASSERTION_FAILED: malformed profile phone was accepted';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('INVALID_PROFILE_PHONE' in sqlerrm) = 0 then raise; end if;
  end;

  for v_count in 1..8 loop
    insert into public.addresses (user_id, label, street, number, city, province)
    values (v_user_id, 'Direccion ' || v_count, 'Calle prueba', v_count::text, 'Rosario', 'Santa Fe');
  end loop;
  begin
    insert into public.addresses (user_id, label, street, number, city, province)
    values (v_user_id, 'Direccion 9', 'Calle prueba', '9', 'Rosario', 'Santa Fe');
    raise exception 'ASSERTION_FAILED: database address limit was bypassed';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('USER_COLLECTION_LIMIT_REACHED:addresses' in sqlerrm) = 0 then raise; end if;
  end;

  perform public.sync_user_cart(
    v_user_id,
    jsonb_build_array(jsonb_build_object('product_id', v_product_id, 'quantity', 2))
  );
  if not exists (
    select 1 from public.cart_items
    where user_id = v_user_id and product_id = v_product_id and quantity = 2
  ) then
    raise exception 'ASSERTION_FAILED: atomic cart sync did not persist the product';
  end if;
  perform public.sync_user_cart(v_user_id, '[]'::jsonb);
  if exists (select 1 from public.cart_items where user_id = v_user_id) then
    raise exception 'ASSERTION_FAILED: atomic cart sync left a removed product behind';
  end if;

  insert into public.notifications (user_id, target_role, type, title, message)
  values (v_user_id, 'USER', 'DB_TEST', 'Aviso de prueba', 'Contenido protegido')
  returning id into v_notification_id;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    update public.notifications set message = 'Contenido alterado' where id = v_notification_id;
    raise exception 'ASSERTION_FAILED: notification content was mutable';
  exception when others then
    if sqlerrm like 'ASSERTION_FAILED:%' then raise; end if;
    if position('NOTIFICATION_CONTENT_IMMUTABLE' in sqlerrm) = 0 then raise; end if;
  end;
  update public.notifications set read = true, read_at = now() where id = v_notification_id;

  insert into public.reviews (product_id, user_id, rating, comment, approved)
  values (v_product_id, v_user_id, 5, 'Resena valida para moderacion', true)
  returning id into v_review_id;
  if exists (select 1 from public.reviews where id = v_review_id and approved = true) then
    raise exception 'ASSERTION_FAILED: customer review bypassed moderation';
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);

  begin
    insert into public.inventory_movements (
      product_id, actor_id, type, quantity, stock_before, stock_after, reason
    ) values (
      v_product_id, v_admin_id, 'ADJUSTMENT', 1, 10, 15, 'Ajuste aritmetico invalido'
    );
    raise exception 'ASSERTION_FAILED: invalid inventory arithmetic was accepted';
  exception when check_violation then
    null;
  end;

  perform public.admin_transition_order(v_order_id, 'REJECT', 'Pedido de prueba rechazado', v_admin_id);

  if not exists (
    select 1 from public.orders
    where id = v_order_id
      and status = 'CANCELLED'
      and notes = v_original_notes
      and cancellation_reason = 'Pedido de prueba rechazado'
      and cancelled_by = v_admin_id
  ) then
    raise exception 'ASSERTION_FAILED: atomic rejection did not preserve the commercial snapshot';
  end if;

  if not exists (select 1 from public.payments where id = v_payment_id and status = 'FAILED') then
    raise exception 'ASSERTION_FAILED: rejected order left its payment pending';
  end if;

  if not exists (
    select 1 from public.admin_audit_logs
    where entity_id = v_order_id::text and action = 'ORDER_REJECTED_BY_ADMIN'
  ) then
    raise exception 'ASSERTION_FAILED: rejection audit entry is missing';
  end if;

  v_result := public.create_checkout_order(
    v_user_id,
    'Cliente de prueba',
    'db-user@fzac.test',
    '3411234567',
    'PICKUP',
    0,
    v_product_price,
    v_product_price,
    null,
    null,
    'PENDING_ADMIN_APPROVAL',
    'BANK_TRANSFER',
    'fzac-db-integrity-smoke-002',
    '{}'::jsonb,
    v_items
  );
  v_approval_order_id := (v_result ->> 'order_id')::uuid;

  perform public.admin_transition_order(v_approval_order_id, 'APPROVE', '', v_admin_id);
  if not exists (select 1 from public.orders where id = v_approval_order_id and status = 'PENDING_PAYMENT') then
    raise exception 'ASSERTION_FAILED: administrative approval did not enable payment';
  end if;

  select count(*) into v_count
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relkind in ('r', 'p')
    and relname not in ('users', 'Notification', 'AuditLog', '_prisma_migrations')
    and (not relrowsecurity or not relforcerowsecurity);
  if v_count <> 0 then
    raise exception 'ASSERTION_FAILED: % application tables do not FORCE RLS', v_count;
  end if;

  if has_function_privilege('anon', 'public.admin_transition_order(uuid,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.admin_transition_order(uuid,text,text,uuid)', 'EXECUTE') then
    raise exception 'ASSERTION_FAILED: critical admin RPC is executable by a public role';
  end if;

  if has_function_privilege('anon', 'public.archive_assistant_knowledge_version()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.archive_assistant_knowledge_version()', 'EXECUTE') then
    raise exception 'ASSERTION_FAILED: SECURITY DEFINER trigger function is publicly executable';
  end if;

  if has_function_privilege('anon', 'public.sync_user_cart(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.sync_user_cart(uuid,jsonb)', 'EXECUTE') then
    raise exception 'ASSERTION_FAILED: cart synchronization RPC is publicly executable';
  end if;

  if has_table_privilege('anon', 'public.products', 'INSERT')
    or has_table_privilege('authenticated', 'public.products', 'UPDATE') then
    raise exception 'ASSERTION_FAILED: catalog mutation privilege leaked to a public role';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'search_events'
      and cmd = 'INSERT'
      and ('anon' = any(roles) or 'public' = any(roles))
  ) then
    raise exception 'ASSERTION_FAILED: anonymous search-event insertion policy still exists';
  end if;
end
$$;

rollback;

\echo 'Database integrity smoke test passed.'

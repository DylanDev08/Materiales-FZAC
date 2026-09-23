-- Cover frequently joined foreign keys highlighted by the Supabase advisor.
-- These indexes do not alter row visibility or business rules.

create index if not exists chat_messages_sender_id_idx
  on public.chat_messages (sender_id);

create index if not exists chat_conversations_assigned_admin_id_idx
  on public.chat_conversations (assigned_admin_id);

create index if not exists admin_audit_logs_admin_id_idx
  on public.admin_audit_logs (admin_id);

create index if not exists inventory_movements_product_id_idx
  on public.inventory_movements (product_id);

create index if not exists inventory_movements_order_id_idx
  on public.inventory_movements (order_id);

create index if not exists favorites_product_id_idx
  on public.favorites (product_id);

create index if not exists reviews_product_id_idx
  on public.reviews (product_id);

create index if not exists reviews_user_id_idx
  on public.reviews (user_id);

create index if not exists product_views_product_id_idx
  on public.product_views (product_id);

create index if not exists product_views_user_id_idx
  on public.product_views (user_id);

create index if not exists purchase_ticket_items_ticket_id_idx
  on public.purchase_ticket_items (ticket_id);

create index if not exists purchase_ticket_items_product_id_idx
  on public.purchase_ticket_items (product_id);
;\n
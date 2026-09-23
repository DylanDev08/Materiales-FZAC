alter function public.protect_profile_security_fields() set search_path = '';
alter function public.archive_assistant_knowledge_version() set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.create_checkout_order(uuid, text, text, text, text, numeric, numeric, numeric, jsonb, text, text, text, text, jsonb, jsonb) set search_path = '';
alter function public.finalize_paid_order(uuid, text, jsonb) set search_path = '';
alter function public.finalize_refunded_order(uuid, text, jsonb, text, uuid, text) set search_path = '';
alter function public.create_purchase_order(uuid, uuid, date, text, jsonb, uuid) set search_path = '';
alter function public.receive_purchase_order(uuid, jsonb, uuid) set search_path = '';;\n
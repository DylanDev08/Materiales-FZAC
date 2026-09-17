alter function public.checkout_integrity_status() set search_path = '';
alter function public.register_supplier_invoice(uuid, uuid, text, numeric, date, date, text, uuid) set search_path = '';
alter function public.register_supplier_payment(uuid, uuid, numeric, text, text, timestamptz, text, uuid) set search_path = '';
alter function public.void_supplier_invoice(uuid, text, uuid) set search_path = '';
alter function public.void_supplier_payment(uuid, text, uuid) set search_path = '';

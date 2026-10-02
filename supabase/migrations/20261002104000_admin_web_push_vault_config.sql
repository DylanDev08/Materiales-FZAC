create or replace function public.get_admin_web_push_config()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_public text;
  v_private text;
  v_subject text;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select decrypted_secret into v_public
  from vault.decrypted_secrets
  where name = 'fzac_web_push_vapid_public'
  limit 1;

  select decrypted_secret into v_private
  from vault.decrypted_secrets
  where name = 'fzac_web_push_vapid_private'
  limit 1;

  select decrypted_secret into v_subject
  from vault.decrypted_secrets
  where name = 'fzac_web_push_vapid_subject'
  limit 1;

  return jsonb_build_object(
    'publicKey', coalesce(v_public, ''),
    'privateKey', coalesce(v_private, ''),
    'subject', coalesce(v_subject, '')
  );
end;
$$;

revoke all on function public.get_admin_web_push_config() from public, anon, authenticated;
grant execute on function public.get_admin_web_push_config() to service_role;

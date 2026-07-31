-- Defense-in-depth for consumer requests containing personal data.
-- Submissions and administrative mutations remain server-side through
-- service_role. This migration does not delete records or relax RLS.

begin;

alter table public.consumer_refund_requests force row level security;

revoke all on table public.consumer_refund_requests from anon;
revoke insert, update, delete, truncate, references, trigger
on table public.consumer_refund_requests
from authenticated;

grant select on table public.consumer_refund_requests to authenticated;
grant all on table public.consumer_refund_requests to service_role;

comment on table public.consumer_refund_requests is
  'Private consumer-rights requests. Public writes are accepted only by the protected application API.';
comment on column public.consumer_refund_requests.email is
  'Personal contact data. Do not expose outside owner/admin workflows.';
comment on column public.consumer_refund_requests.phone is
  'Personal contact data. Do not expose outside owner/admin workflows.';
comment on column public.consumer_refund_requests.metadata is
  'Operational metadata only. Never store passwords, payment credentials, card data or authentication tokens.';

commit;

-- Internal trigger helper: it must not be exposed as a callable RPC to storefront roles.
revoke execute on function public.archive_assistant_knowledge_version() from public;
revoke execute on function public.archive_assistant_knowledge_version() from anon;
revoke execute on function public.archive_assistant_knowledge_version() from authenticated;
grant execute on function public.archive_assistant_knowledge_version() to service_role;


-- Customer mutations are validated by application routes using the service role.
-- Keep owner-scoped SELECT where useful, but remove browser-side mutation paths.
revoke insert, update, delete on table public.profiles from authenticated;
revoke insert, update, delete on table public.addresses from authenticated;
revoke insert, update, delete on table public.cart_items from authenticated;
revoke insert, update, delete on table public.favorites from authenticated;
revoke insert, update, delete on table public.user_preferences from authenticated;
;\n
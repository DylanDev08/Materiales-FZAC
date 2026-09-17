-- Anonymous users: no direct access to user/private operational tables.
revoke all privileges on table public.addresses from anon;
revoke all privileges on table public.cart_items from anon;
revoke all privileges on table public.favorites from anon;
revoke all privileges on table public.notifications from anon;
revoke all privileges on table public.product_events from anon;
revoke all privileges on table public.product_views from anon;
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.search_events from anon;
revoke all privileges on table public.user_preferences from anon;

-- Anonymous public catalog/content is read-only.
revoke insert, update, delete, truncate, references, trigger on table public.categories from anon;
revoke insert, update, delete, truncate, references, trigger on table public.products from anon;
revoke insert, update, delete, truncate, references, trigger on table public.reviews from anon;
revoke insert, update, delete, truncate, references, trigger on table public.store_settings from anon;

-- Authenticated user-owned collections keep CRUD but not schema-level/DDL-adjacent privileges.
revoke truncate, references, trigger on table public.addresses from authenticated;
revoke truncate, references, trigger on table public.cart_items from authenticated;
revoke truncate, references, trigger on table public.favorites from authenticated;

-- Notifications are read/mark-read from the client; creation/deletion is server/admin only.
revoke insert, delete, truncate, references, trigger on table public.notifications from authenticated;

-- Telemetry/operational datasets are not client-writable.
revoke insert, update, delete, truncate, references, trigger on table public.product_events from authenticated;
revoke update, delete, truncate, references, trigger on table public.product_views from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.search_events from authenticated;

-- Catalog/settings are public read-only; admin mutations use service_role server-side.
revoke insert, update, delete, truncate, references, trigger on table public.categories from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.products from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.store_settings from authenticated;

-- Profiles can be selected/created/updated by owner according to RLS, never deleted/truncated directly.
revoke delete, truncate, references, trigger on table public.profiles from authenticated;

-- Reviews: users may read/submit; moderation and destructive changes are server/admin only.
revoke update, delete, truncate, references, trigger on table public.reviews from authenticated;

-- Preferences: owner select/insert/update only.
revoke delete, truncate, references, trigger on table public.user_preferences from authenticated;

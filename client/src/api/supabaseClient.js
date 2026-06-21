import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseAuthEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseAuthEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const supabaseClient = supabase;

export const signInWithGoogle = async () => {
  if (!supabase) {
    throw new Error('Supabase Auth no está configurado todavía.');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        prompt: 'select_account'
      }
    }
  });

  if (error) throw error;
  return data;
};

export const signOutFromSupabase = async () => {
  if (!supabase) return null;
  return supabase.auth.signOut();
};

export default supabase;

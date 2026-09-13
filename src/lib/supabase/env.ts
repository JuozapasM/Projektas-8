const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY = 'placeholder-anon-key';

function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return (
    value.includes('your-supabase') ||
    value.includes('your-anon-key') ||
    value.includes('placeholder')
  );
}

/**
 * Resolves the Supabase URL/anon key, preferring the NEXT_PUBLIC_ vars
 * (available in the browser) with a server-only fallback name, and
 * substituting safe placeholders when nothing is configured so client
 * construction never throws.
 */
export function getSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  return {
    url: rawUrl || PLACEHOLDER_URL,
    anonKey: rawAnonKey || PLACEHOLDER_ANON_KEY,
    isConfigured: !looksLikePlaceholder(rawUrl) && !looksLikePlaceholder(rawAnonKey),
  };
}

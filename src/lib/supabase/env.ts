const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY = 'placeholder-anon-key';

function looksLikePlaceholder(value: string | undefined): boolean {
  return !value || /your[-_]?(supabase|anon|project)|placeholder|<|>/i.test(value);
}

/** Use the same public configuration on the server and in the browser. */
export function getSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  let validUrl = false;
  try {
    const parsed = new URL(rawUrl || '');
    validUrl = ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch { /* Not configured yet. */ }
  const isConfigured = validUrl && !looksLikePlaceholder(rawUrl) && !looksLikePlaceholder(rawAnonKey);
  return { url: isConfigured ? rawUrl! : PLACEHOLDER_URL, anonKey: isConfigured ? rawAnonKey! : PLACEHOLDER_ANON_KEY, isConfigured };
}

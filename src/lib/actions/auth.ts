'use server';

import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { getSiteOrigin } from '@/lib/site';
import { safeNextPath } from '@/lib/events';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';

type AuthResult = { error?: string; message?: string };
function readField(formData: FormData, field: string) { const value = formData.get(field); return typeof value === 'string' ? value : ''; }
function normalizeUsername(username: string) { return username.trim().normalize('NFKC').toLocaleLowerCase('lt-LT'); }
function formatEmail(username: string) { return `${createHash('sha256').update(normalizeUsername(username), 'utf8').digest('hex')}@auksinisprotas.com`; }
function validEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const identifier = readField(formData, 'username').trim(); const password = readField(formData, 'password');
  if (!identifier || !password) return { error: 'Įveskite el. paštą arba ankstesnį vartotojo vardą ir slaptažodį.' };
  const emailLogin = identifier.includes('@');
  if (emailLogin ? !validEmail(identifier) : identifier.length > 32) return { error: 'Neteisingas el. paštas arba vartotojo vardas.' };
  if (!getSupabaseEnv().isConfigured) return { error: 'Prisijungimas šiuo metu nepasiekiamas. Bandykite vėliau.' };
  const supabase = await createClient(); const legacyName = identifier.toLowerCase().replace(/[^a-z0-9]/g, '');
  const emails = emailLogin ? [identifier.toLowerCase()] : [formatEmail(identifier), ...(legacyName ? [`${legacyName}@auksinisprotas.com`, `${legacyName}@auksinisprotas.local`] : [])];
  let signedIn = false;
  try {
    for (const email of emails) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', data.user.id).maybeSingle();
        if (profile && (emailLogin || normalizeUsername(profile.username) === normalizeUsername(identifier))) { signedIn = true; break; }
        await supabase.auth.signOut();
      }
    }
  } catch { return { error: 'Nepavyko prisijungti. Bandykite dar kartą.' }; }
  if (!signedIn) return { error: 'Neteisingi prisijungimo duomenys arba el. paštas dar nepatvirtintas.' };
  redirect(safeNextPath(readField(formData,'next')));
}

export async function registerAction(formData: FormData): Promise<AuthResult> {
  const username = readField(formData,'username').trim().normalize('NFKC'); const password = readField(formData,'password'); const email = readField(formData,'email').trim().toLowerCase();
  if (!/^[\p{L}\p{N}_.-]{2,32}$/u.test(username)) return { error: 'Vardą turi sudaryti 2–32 simboliai: raidės, skaičiai, taškas, brūkšnelis arba pabraukimas.' };
  if (!validEmail(email)) return { error: 'Įveskite galiojantį el. pašto adresą.' };
  if (password.length < 6) return { error: 'Slaptažodis turi būti bent 6 simbolių.' };
  if (!getSupabaseEnv().isConfigured) return { error: 'Registracija šiuo metu nepasiekiama. Bandykite vėliau.' };
  const next = safeNextPath(readField(formData,'next'));
  try {
    const supabase = await createClient();
    const { data: existing, error: lookupError } = await supabase.from('profiles').select('id').ilike('username',username.replace(/[_%\\]/g,'\\$&')).maybeSingle();
    if (lookupError) return { error: 'Nepavyko patikrinti vardo. Bandykite vėliau.' };
    if (existing) return { error: 'Šis vartotojo vardas jau užimtas!' };
    const origin = await getSiteOrigin();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error || !data.user) return { error: 'Nepavyko sukurti paskyros. Pabandykite prisijungti arba pasirinkite kitą vardą.' };
    if (!data.session) return { message: 'Patikrinkite el. paštą ir patvirtinkite paskyrą. Tada galėsite rezervuoti vietą pasirinktame renginyje.' };
  } catch { return { error: 'Registracija nepavyko. Bandykite dar kartą arba prisijunkite, jei paskyra jau sukurta.' }; }
  // Registration no longer silently reserves a seat in an unrelated legacy hall.
  redirect(next);
}

export async function requestPasswordResetAction(formData: FormData): Promise<AuthResult> {
  const email = readField(formData,'email').trim().toLowerCase();
  if (!validEmail(email)) return { error: 'Įveskite galiojantį el. pašto adresą.' };
  if (!getSupabaseEnv().isConfigured) return { error: 'Slaptažodžio atkūrimas šiuo metu nepasiekiamas.' };
  try {
    const { error } = await (await createClient()).auth.resetPasswordForEmail(email,{redirectTo:`${await getSiteOrigin()}/auth/callback?next=/auth/reset-password`});
    if (error) return { error: 'Nepavyko išsiųsti nuorodos. Bandykite vėliau.' };
    return { message: 'Jei šiuo el. paštu yra paskyra, išsiuntėme slaptažodžio atkūrimo nuorodą.' };
  } catch { return { error: 'Slaptažodžio atkūrimas šiuo metu nepasiekiamas.' }; }
}
export async function resetPasswordAction(formData: FormData): Promise<AuthResult> {
  const password = readField(formData,'password');
  if (password.length < 6) return { error: 'Slaptažodis turi būti bent 6 simbolių.' };
  if (password !== readField(formData,'password_confirmation')) return { error: 'Slaptažodžiai nesutampa.' };
  if (!getSupabaseEnv().isConfigured) return { error: 'Paslauga šiuo metu nepasiekiama.' };
  try {
    const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Atkūrimo nuoroda nebegalioja. Paprašykite naujos nuorodos.' };
    const { error } = await supabase.auth.updateUser({password});
    if (error) return { error: 'Nepavyko pakeisti slaptažodžio. Paprašykite naujos atkūrimo nuorodos.' };
    await supabase.auth.signOut();
  } catch { return { error: 'Paslauga šiuo metu nepasiekiama.' }; }
  redirect('/auth/login?notice=password-updated');
}
export async function logoutAction() { await (await createClient()).auth.signOut(); redirect('/auth/login'); }

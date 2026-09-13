'use server';

import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';

function readField(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function normalizeUsername(username: string) {
  return username.trim().normalize('NFKC').toLocaleLowerCase('lt-LT');
}

function formatEmail(username: string) {
  // Preserve Unicode characters and punctuation instead of collapsing distinct names.
  const identifier = createHash('sha256').update(normalizeUsername(username), 'utf8').digest('hex');
  return `${identifier}@auksinisprotas.com`;
}

export async function loginAction(formData: FormData) {
  const username = readField(formData, 'username').trim();
  const password = readField(formData, 'password');
  if (!username || !password) return { error: 'Įveskite vartotojo vardą ir slaptažodį.' };
  if (username.length > 32) return { error: 'Vartotojo vardas negali viršyti 32 simbolių.' };
  if (!getSupabaseEnv().isConfigured) return { error: 'Prisijungimas šiuo metu nepasiekiamas. Bandykite vėliau.' };

  const supabase = await createClient();
  const legacyName = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const emails = [formatEmail(username), ...(legacyName ? [`${legacyName}@auksinisprotas.com`, `${legacyName}@auksinisprotas.local`] : [])];
  let signedIn = false;
  try {
    for (const email of emails) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', data.user.id).maybeSingle();
        if (profile && normalizeUsername(profile.username) === normalizeUsername(username)) {
          signedIn = true;
          break;
        }
        // A legacy email can correspond to a different name after character stripping.
        await supabase.auth.signOut();
      }
    }
  } catch { return { error: 'Nepavyko prisijungti. Bandykite dar kartą.' }; }
  if (!signedIn) return { error: 'Neteisingas vartotojo vardas arba slaptažodis.' };
  redirect('/');
}

export async function registerAction(formData: FormData) {
  const username = readField(formData, 'username').trim().normalize('NFKC');
  const password = readField(formData, 'password');
  if (!/^[\p{L}\p{N}_.-]{2,32}$/u.test(username)) return { error: 'Vardą turi sudaryti 2–32 simboliai: raidės, skaičiai, taškas, brūkšnelis arba pabraukimas.' };
  if (password.length < 6) return { error: 'Slaptažodis turi būti bent 6 simbolių.' };
  if (!getSupabaseEnv().isConfigured) return { error: 'Registracija šiuo metu nepasiekiama. Bandykite vėliau.' };

  const supabase = await createClient();
  let notice = '';
  try {
    const { data: existingProfile, error: lookupError } = await supabase.from('profiles').select('id').ilike('username', username.replace(/[_%\\]/g, '\\$&')).maybeSingle();
    if (lookupError) return { error: 'Nepavyko patikrinti vardo. Bandykite vėliau.' };
    if (existingProfile) return { error: 'Šis vartotojo vardas jau užimtas!' };

    // The database trigger creates a player profile. Admin rights are assigned manually.
    const { data, error } = await supabase.auth.signUp({ email: formatEmail(username), password, options: { data: { username } } });
    if (error || !data.user) return { error: 'Nepavyko sukurti paskyros. Vardas gali būti užimtas; pabandykite prisijungti.' };
    if (!data.session) return { error: 'Paskyros registracijai reikalingas el. pašto patvirtinimas. Kreipkitės į organizatorių, kad įjungtų registraciją žaidėjo vardu.' };
    const { data: result, error: seatError } = await supabase.rpc('assign_random_seat', { p_user_id: data.user.id });
    if (seatError || !result?.success) notice = 'seat-unavailable';
  } catch { return { error: 'Registracija nepavyko. Bandykite dar kartą arba prisijunkite, jei paskyra jau sukurta.' }; }
  redirect(notice ? `/?notice=${notice}` : '/');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}

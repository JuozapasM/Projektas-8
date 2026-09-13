'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function formatEmail(username: string): string {
  // Clean username for internal auth email
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanUsername}@auksinisprotas.com`;
}

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Įveskite vartotojo vardą ir slaptažodį.' };
  }

  const supabase = await createClient();
  let email = formatEmail(username);

  let { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Fallback check for accounts registered with former .local suffix
  if (error) {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const fallbackEmail = `${cleanUsername}@auksinisprotas.local`;
    const fallbackRes = await supabase.auth.signInWithPassword({
      email: fallbackEmail,
      password,
    });
    if (!fallbackRes.error) {
      error = null;
    }
  }

  if (error) {
    return { error: 'Neteisingas vartotojo vardas arba slaptažodis, arba paskyra dar nesukurta.' };
  }

  redirect('/');
}

export async function registerAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || username.trim().length < 2) {
    return { error: 'Vartotojo vardas turi būti bent 2 simbolių.' };
  }

  if (!password || password.length < 6) {
    return { error: 'Slaptažodis turi būti bent 6 simbolių.' };
  }

  const supabase = await createClient();
  const email = formatEmail(username.trim());

  // Check if profile username already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username.trim())
    .single();

  if (existingProfile) {
    return { error: 'Šis vartotojo vardas jau užimtas!' };
  }

  // Register user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.trim(),
      },
    },
  });

  if (error || !data.user) {
    return { error: error?.message || 'Nepavyko prisiregistruoti.' };
  }

  // Insert profile
  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    username: username.trim(),
    role: 'player',
  });

  if (profileError) {
    return { error: 'Klaida kuriant vartotojo profilį: ' + profileError.message };
  }

  // Sign in automatically
  await supabase.auth.signInWithPassword({
    email,
    password,
  });

  redirect('/');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}

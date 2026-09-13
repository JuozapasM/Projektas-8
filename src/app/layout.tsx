import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Auksinis Protas – žaidimų vakarai', template: '%s | Auksinis Protas' },
  description: 'Pasirinkite Auksinio Proto vakarą, rezervuokite vietą sau ar komandai ir turėkite savo bilietą po ranka.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let currentUser = null;

  try {
    if (getSupabaseEnv().isConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, role')
        .eq('id', user.id)
        .single();

      if (profile) {
        currentUser = {
          id: user.id,
          username: profile.username,
          role: profile.role,
        };
      }
    }
    }
  } catch (err) {
    // Graceful fallback if Supabase env vars are not set during initial build
    console.error('Supabase client error:', err);
  }

  return (
    <html lang="lt">
      <body className="text-slate-100 min-h-screen flex flex-col antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-amber-200 focus:text-slate-950 focus:p-3">Pereiti prie turinio</a>
        <Navbar user={currentUser} />
        <main id="main-content" className="flex-1 py-8 sm:py-12">{children}</main>
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Auksinis Protas Žaidimų Organizavimo Platforma
        </footer>
      </body>
    </html>
  );
}

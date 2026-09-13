import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Auksinis Protas - Žaidimo Stalų Rezervacija',
  description: 'Stalų ir vietų rezervavimo platforma Auksinis Protas žaidimui',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let currentUser = null;

  try {
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
  } catch (err) {
    // Graceful fallback if Supabase env vars are not set during initial build
    console.error('Supabase client error:', err);
  }

  return (
    <html lang="lt">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <Navbar user={currentUser} />
        <main className="flex-1 py-8">{children}</main>
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Auksinis Protas Žaidimų Organizavimo Platforma
        </footer>
      </body>
    </html>
  );
}

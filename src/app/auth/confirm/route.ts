import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/events';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash'); const type = request.nextUrl.searchParams.get('type');
  if (tokenHash && (type === 'signup' || type === 'recovery' || type === 'email_change')) {
    try {
      const { error } = await (await createClient()).auth.verifyOtp({token_hash:tokenHash,type});
      if (!error) return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next'),type === 'recovery' ? '/auth/reset-password' : '/?notice=email-confirmed'),request.url));
    } catch {
      // Keep temporary provider failures out of the application's error page.
    }
  }
  return NextResponse.redirect(new URL('/auth/login?error=link-expired',request.url));
}

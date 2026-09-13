import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/events';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    try {
      const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next'), '/?notice=email-confirmed'),request.url));
    } catch {
      // Provider failures should lead to the same recoverable state as expired links.
    }
  }
  return NextResponse.redirect(new URL('/auth/login?error=link-expired',request.url));
}

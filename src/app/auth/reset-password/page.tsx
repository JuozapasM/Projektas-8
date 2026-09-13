import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { PasswordForm } from '@/components/PasswordForm';
export default async function ResetPasswordPage() {
  if (!getSupabaseEnv().isConfigured) redirect('/auth/forgot-password');
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect('/auth/forgot-password');
  return <PasswordForm reset />;
}

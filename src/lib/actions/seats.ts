'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function reserveSeatAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Esate neprisijungęs' };
  }

  const { data, error } = await supabase.rpc('assign_random_seat', {
    p_user_id: user.id,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/');
  return data;
}

export async function cancelSeatAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Esate neprisijungęs' };
  }

  const { data, error } = await supabase.rpc('cancel_seat_reservation', {
    p_user_id: user.id,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/');
  return data;
}

export async function adminRemoveSeatAction(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Esate neprisijungęs' };
  }

  // Check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, message: 'Neturite administratoriaus teisių' };
  }

  const { data, error } = await supabase.rpc('admin_remove_seat', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/');
  return data;
}

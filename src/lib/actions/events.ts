'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { isUuid } from '@/lib/events';
import { ActionResult } from '@/types/database';

async function callRpc(name: string, args: Record<string, unknown>, eventId?: string): Promise<ActionResult> {
  if (!getSupabaseEnv().isConfigured) return { success: false, message: 'Paslauga šiuo metu nepasiekiama.' };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'Prisijunkite prie paskyros.' };
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      // Deliberate business-rule errors from our RPCs are safe to show; hide internal DB errors.
      return { success: false, message: error.code === 'P0001' ? error.message : 'Veiksmas nepavyko. Bandykite dar kartą.' };
    }
    revalidatePath('/'); revalidatePath('/results'); revalidatePath('/admin/events'); revalidatePath('/admin/check-in');
    const id = eventId || data?.event_id;
    if (isUuid(id)) { revalidatePath(`/events/${id}`); revalidatePath(`/admin/events/${id}`); }
    revalidatePath('/invite/[token]', 'page');
    return data as ActionResult;
  } catch { return { success: false, message: 'Nepavyko susisiekti su paslauga. Bandykite dar kartą.' }; }
}
const invalid: ActionResult = { success: false, message: 'Neteisingi duomenys.' };
export async function reserveEventAction(eventId: string) { return isUuid(eventId) ? callRpc('reserve_event_seat', { p_event_id: eventId }, eventId) : invalid; }
export async function cancelEventAction(eventId: string, userId?: string) { return isUuid(eventId) && (!userId || isUuid(userId)) ? callRpc('cancel_event_reservation', { p_event_id: eventId, p_user_id: userId || null }, eventId) : invalid; }
export async function createTeamAction(eventId: string, formData: FormData) {
  const name = String(formData.get('team_name') || '').trim(); const capacity = Number(formData.get('capacity'));
  if (!isUuid(eventId) || name.length < 2 || name.length > 60 || !Number.isInteger(capacity) || capacity < 2 || capacity > 4) return invalid;
  return callRpc('create_event_team', { p_event_id: eventId, p_name: name, p_capacity: capacity }, eventId);
}
export async function joinTeamAction(token: string) { return isUuid(token) ? callRpc('join_event_team', { p_token: token }) : invalid; }
function eventFields(formData: FormData) {
  const title = String(formData.get('title') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const startsAt = String(formData.get('starts_at') || '');
  if (title.length < 2 || title.length > 120 || location.length < 2 || location.length > 200 || description.length > 2000 || !Number.isFinite(Date.parse(startsAt))) return null;
  return { p_title: title, p_location: location, p_description: description, p_starts_at: new Date(startsAt).toISOString() };
}
export async function createEventAction(formData: FormData) {
  const fields = eventFields(formData); return fields ? callRpc('create_game_event', fields) : invalid;
}
export async function updateEventAction(eventId: string, formData: FormData) {
  const fields = eventFields(formData); const status = formData.get('status');
  return fields && isUuid(eventId) && ['draft','open','completed','cancelled'].includes(String(status)) ? callRpc('update_game_event', { ...fields, p_event_id: eventId, p_status: status }, eventId) : invalid;
}
export async function checkInAction(token: string) { return isUuid(token) ? callRpc('check_in_event', { p_token: token }) : invalid; }
export async function saveResultAction(eventId: string, formData: FormData) {
  const table = Number(formData.get('table_number')); const points = Number(formData.get('points')); const name = String(formData.get('team_name') || '').trim();
  if (!isUuid(eventId) || !Number.isInteger(table) || table < 1 || table > 6 || !Number.isInteger(points) || points < 0 || points > 1000000 || name.length < 2 || name.length > 60) return invalid;
  return callRpc('save_event_result', { p_event_id: eventId, p_table_number: table, p_team_name: name, p_points: points }, eventId);
}
export async function publishResultsAction(eventId: string, published: boolean) { return isUuid(eventId) && typeof published === 'boolean' ? callRpc('publish_event_results', { p_event_id: eventId, p_published: published }, eventId) : invalid; }

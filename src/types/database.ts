export type Role = 'player' | 'admin';

export interface Profile {
  id: string;
  username: string;
  role: Role;
  created_at: string;
}

export interface Seat {
  event_id?: string;
  team_id?: string | null;
  id: string;
  table_number: number;
  seat_number: number;
  user_id: string | null;
  updated_at: string;
  profiles?: Pick<Profile, 'username'> | null;
}

export interface SeatHistory {
  id: string;
  user_id: string | null;
  username: string;
  table_number: number;
  seat_number: number;
  action: 'RESERVED' | 'CANCELLED' | 'ADMIN_REMOVED';
  created_at: string;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  status: 'draft' | 'open' | 'completed' | 'cancelled';
  results_published: boolean;
  created_at: string;
}
export interface EventTeam {
  id: string;
  event_id: string;
  owner_id: string;
  name: string;
  capacity: number;
  invite_token: string;
}
export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  seat_id: string | null;
  team_id: string | null;
  status: 'reserved' | 'waiting' | 'cancelled';
  checkin_token: string;
  checked_in_at: string | null;
  created_at: string;
  event_teams?: EventTeam | null;
  profiles?: Pick<Profile, 'username'> | null;
  event_seats?: Seat | null;
  game_events?: GameEvent | null;
}
export interface EventResult {
  id: string;
  event_id: string;
  table_number: number;
  team_name: string;
  points: number;
}
export interface ActionResult {
  success: boolean;
  message: string;
  event_id?: string;
}

export type Role = 'player' | 'admin';

export interface Profile {
  id: string;
  username: string;
  role: Role;
  created_at: string;
}

export interface Seat {
  id: string;
  table_number: number;
  seat_number: number;
  user_id: string | null;
  updated_at: string;
  profiles?: Profile | null;
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

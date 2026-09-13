-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function to automatically create profile when user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_role TEXT := 'player';
BEGIN
  v_username := NEW.raw_user_meta_data->>'username';
  IF v_username IS NULL OR v_username = '' THEN
    v_username := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  IF LOWER(v_username) = 'juozapas' THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, v_username, v_role)
  ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      role = CASE WHEN LOWER(EXCLUDED.username) = 'juozapas' THEN 'admin' ELSE public.profiles.role END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger function to automatically set 'admin' role when 'Juozapas' profile is inserted/updated
CREATE OR REPLACE FUNCTION public.handle_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  IF LOWER(NEW.username) = 'juozapas' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_admin_role_trigger ON public.profiles;
CREATE TRIGGER set_admin_role_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_role();

-- 2. Seats Table (6 tables x 4 seats = 24 total)
CREATE TABLE IF NOT EXISTS public.seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INT NOT NULL CHECK (table_number BETWEEN 1 AND 6),
  seat_number INT NOT NULL CHECK (seat_number BETWEEN 1 AND 4),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(table_number, seat_number)
);

-- 3. Seat History Table (Audit Log)
CREATE TABLE IF NOT EXISTS public.seat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  table_number INT NOT NULL,
  seat_number INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('RESERVED', 'CANCELLED', 'ADMIN_REMOVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert 24 seats if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.seats) THEN
    INSERT INTO public.seats (table_number, seat_number)
    SELECT t, s
    FROM generate_series(1, 6) AS t
    CROSS JOIN generate_series(1, 4) AS s;
  END IF;
END $$;

-- Enable Supabase Realtime for seats if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'seats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;
  END IF;
END $$;

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_history ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view usernames, users can insert their own profile
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Seats: Viewable by everyone, update restricted or via security definer RPC
DROP POLICY IF EXISTS "Seats are viewable by everyone" ON public.seats;
CREATE POLICY "Seats are viewable by everyone" ON public.seats
  FOR SELECT USING (true);

-- Seat History: Viewable by admins, insertable by functions
DROP POLICY IF EXISTS "Seat history viewable by everyone logged in" ON public.seat_history;
CREATE POLICY "Seat history viewable by everyone logged in" ON public.seat_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Atomic RPC: Assign random available seat to user
CREATE OR REPLACE FUNCTION public.assign_random_seat(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seat RECORD;
  v_username TEXT;
  v_existing_seat RECORD;
BEGIN
  -- Get username
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF v_username IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Check if user already has a seat
  SELECT * INTO v_existing_seat FROM public.seats WHERE user_id = p_user_id;
  IF v_existing_seat.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Jūs jau turite priskirtą vietą prie stalo ' || v_existing_seat.table_number || ', vieta ' || v_existing_seat.seat_number
    );
  END IF;

  -- Pick random empty seat with lock
  SELECT * INTO v_seat
  FROM public.seats
  WHERE user_id IS NULL
  ORDER BY RANDOM()
  LIMIT 1
  FOR UPDATE;

  IF v_seat.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Atsiprašome, visos 24 vietos žaidime jau užimtos!'
    );
  END IF;

  -- Update seat
  UPDATE public.seats
  SET user_id = p_user_id, updated_at = NOW()
  WHERE id = v_seat.id;

  -- Record audit history
  INSERT INTO public.seat_history (user_id, username, table_number, seat_number, action)
  VALUES (p_user_id, v_username, v_seat.table_number, v_seat.seat_number, 'RESERVED');

  RETURN jsonb_build_object(
    'success', true,
    'table_number', v_seat.table_number,
    'seat_number', v_seat.seat_number
  );
END;
$$;

-- Atomic RPC: Cancel seat reservation
CREATE OR REPLACE FUNCTION public.cancel_seat_reservation(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seat RECORD;
  v_username TEXT;
BEGIN
  -- Get username
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;

  -- Find seat occupied by user
  SELECT * INTO v_seat FROM public.seats WHERE user_id = p_user_id FOR UPDATE;

  IF v_seat.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Jūs neturite aktyvios vietos rezervacijos');
  END IF;

  -- Release seat
  UPDATE public.seats
  SET user_id = NULL, updated_at = NOW()
  WHERE id = v_seat.id;

  -- Record audit history
  INSERT INTO public.seat_history (user_id, username, table_number, seat_number, action)
  VALUES (p_user_id, COALESCE(v_username, 'Žaidėjas'), v_seat.table_number, v_seat.seat_number, 'CANCELLED');

  RETURN jsonb_build_object('success', true, 'message', 'Rezervacija sėkmingai atšaukta');
END;
$$;

-- Atomic RPC: Admin remove user from seat
CREATE OR REPLACE FUNCTION public.admin_remove_seat(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seat RECORD;
  v_username TEXT;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = p_target_user_id;
  SELECT * INTO v_seat FROM public.seats WHERE user_id = p_target_user_id FOR UPDATE;

  IF v_seat.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dalyvis neturi priskirtos vietos');
  END IF;

  UPDATE public.seats
  SET user_id = NULL, updated_at = NOW()
  WHERE id = v_seat.id;

  INSERT INTO public.seat_history (user_id, username, table_number, seat_number, action)
  VALUES (p_target_user_id, COALESCE(v_username, 'Dalyvis'), v_seat.table_number, v_seat.seat_number, 'ADMIN_REMOVED');

  RETURN jsonb_build_object('success', true, 'message', 'Dalyvio vieta atlaisvinta administratoriaus');
END;
$$;

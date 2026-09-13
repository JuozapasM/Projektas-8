-- Apply in Supabase SQL Editor to secure an existing installation.
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := NEW.raw_user_meta_data->>'username';
  IF v_username IS NULL OR v_username = '' THEN
    v_username := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, v_username, 'player')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Admin rights are granted manually by a trusted database operator.
DROP TRIGGER IF EXISTS set_admin_role_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_admin_role();


DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id AND role = 'player');


DROP POLICY IF EXISTS "Seat history viewable by everyone logged in" ON public.seat_history;
CREATE POLICY "Seat history viewable by everyone logged in" ON public.seat_history
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Atomic RPC: Assign random available seat to user
CREATE OR REPLACE FUNCTION public.assign_random_seat(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seat RECORD;
  v_username TEXT;
  v_existing_seat RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Neturite teisės keisti kito žaidėjo rezervacijos';
  END IF;

  -- Serialize reservation changes for the same player.
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

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
  FOR UPDATE SKIP LOCKED;

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
SET search_path = ''
AS $$
DECLARE
  v_seat RECORD;
  v_username TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Neturite teisės keisti kito žaidėjo rezervacijos';
  END IF;

  -- Serialize reservation changes for the same player.
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

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
SET search_path = ''
AS $$
DECLARE
  v_seat RECORD;
  v_username TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Neturite administratoriaus teisių';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_target_user_id FOR UPDATE;

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

-- These privileged functions may only be called by authenticated users.
REVOKE EXECUTE ON FUNCTION public.assign_random_seat(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_seat_reservation(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_seat(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_random_seat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_seat_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_seat(UUID) TO authenticated;

COMMIT;

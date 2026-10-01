-- ============================================================
-- Toolkit DB update: RPC search_path fix + outreach GPS columns
-- Run this AFTER the table/column renames (migration.sql)
-- ============================================================
--
-- What this does:
--   1. Adds latitude/longitude to outreach_events for location-based check-in
--   2. Replaces all 3 RPC functions (build_action, outreach_action, opi_action)
--      with search_path='public' so is_member()/has_perm() can find profiles
--   3. Adds self_checkin / self_checkout actions to outreach_action
-- ============================================================

-- =============================================
-- 1. Add GPS columns to outreach_events
-- =============================================
ALTER TABLE outreach_events ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE outreach_events ADD COLUMN IF NOT EXISTS longitude double precision;

-- =============================================
-- 2. outreach_action RPC
-- =============================================
CREATE OR REPLACE FUNCTION outreach_action(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  eid uuid;
  r record;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'create' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO outreach_events (title, description, location, latitude, longitude, starts_at, ends_at, season_id)
    VALUES (
      payload->>'title',
      payload->>'description',
      payload->>'location',
      (payload->>'latitude')::double precision,
      (payload->>'longitude')::double precision,
      (payload->>'starts_at')::timestamptz,
      (payload->>'ends_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1))
    ) RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'edit' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    eid := (payload->>'id')::uuid;
    UPDATE outreach_events SET
      title = COALESCE(payload->>'title', title),
      description = COALESCE(payload->>'description', description),
      location = COALESCE(payload->>'location', location),
      latitude = COALESCE((payload->>'latitude')::double precision, latitude),
      longitude = COALESCE((payload->>'longitude')::double precision, longitude),
      starts_at = COALESCE((payload->>'starts_at')::timestamptz, starts_at),
      ends_at = COALESCE((payload->>'ends_at')::timestamptz, ends_at)
    WHERE id = eid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'cancel' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE outreach_events SET cancelled = true WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'restore' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE outreach_events SET cancelled = false WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'leads' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    eid := (payload->>'event_id')::uuid;
    DELETE FROM outreach_leads WHERE event_id = eid;
    INSERT INTO outreach_leads (event_id, member_id)
    SELECT eid, (j.value)::uuid FROM jsonb_array_elements_text(payload->'member_ids') j;
    SELECT to_jsonb(e.*) INTO result FROM outreach_events e WHERE e.id = eid;

  WHEN 'rsvp' THEN
    eid := (payload->>'event_id')::uuid;
    IF (payload->>'planned')::boolean THEN
      INSERT INTO outreach_rsvps (event_id, member_id, planned) VALUES (eid, uid, true)
      ON CONFLICT (event_id, member_id) DO UPDATE SET planned = true;
    ELSE
      DELETE FROM outreach_rsvps WHERE event_id = eid AND member_id = uid;
    END IF;
    result := jsonb_build_object('event_id', eid, 'member_id', uid, 'planned', (payload->>'planned')::boolean);

  WHEN 'attendance' THEN
    IF NOT has_perm('manage_outreach_attendance') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO outreach_attendance (event_id, member_id, arrival, departure, credited_minutes)
    VALUES (
      (payload->>'event_id')::uuid,
      (payload->>'member_id')::uuid,
      (payload->>'arrival')::timestamptz,
      (payload->>'departure')::timestamptz,
      EXTRACT(EPOCH FROM ((payload->>'departure')::timestamptz - (payload->>'arrival')::timestamptz))::integer / 60
    )
    ON CONFLICT (event_id, member_id) DO UPDATE SET
      arrival = EXCLUDED.arrival,
      departure = EXCLUDED.departure,
      credited_minutes = EXCLUDED.credited_minutes
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  WHEN 'self_checkin' THEN
    eid := (payload->>'event_id')::uuid;
    SELECT * INTO r FROM outreach_events WHERE id = eid;
    IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
    IF r.cancelled THEN RAISE EXCEPTION 'event cancelled'; END IF;
    IF r.ends_at IS NOT NULL AND now() > r.ends_at THEN RAISE EXCEPTION 'event has ended'; END IF;
    SELECT * INTO r FROM outreach_attendance WHERE event_id = eid AND member_id = uid;
    IF FOUND THEN
      IF r.departure IS NULL THEN
        result := to_jsonb(r);
        RETURN result;
      END IF;
      RAISE EXCEPTION 'already attended this event';
    END IF;
    INSERT INTO outreach_attendance (event_id, member_id, arrival)
    VALUES (eid, uid, now())
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  WHEN 'self_checkout' THEN
    eid := (payload->>'event_id')::uuid;
    SELECT * INTO r FROM outreach_attendance WHERE event_id = eid AND member_id = uid AND departure IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'no active check-in for this event'; END IF;
    UPDATE outreach_attendance SET
      departure = now(),
      credited_minutes = EXTRACT(EPOCH FROM (now() - arrival))::integer / 60
    WHERE event_id = eid AND member_id = uid AND departure IS NULL
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$$;

-- =============================================
-- 3. opi_action RPC
-- =============================================
CREATE OR REPLACE FUNCTION opi_action(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  oid uuid;
  r record;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'submit' THEN
    INSERT INTO opis (submitter_id, title, summary, document_url, status)
    VALUES (uid, payload->>'title', payload->>'summary', payload->>'document_url', 'SUBMITTED')
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_versions (opi_id, title, summary, document_url)
    VALUES ((result->>'id')::uuid, payload->>'title', payload->>'summary', payload->>'document_url');

  WHEN 'resubmit' THEN
    oid := (payload->>'id')::uuid;
    SELECT * INTO r FROM opis WHERE id = oid;
    IF r.submitter_id != uid THEN RAISE EXCEPTION 'not owner'; END IF;
    IF r.status != 'CHANGES_REQUESTED' THEN RAISE EXCEPTION 'can only resubmit from changes_requested'; END IF;
    UPDATE opis SET
      status = 'RESUBMITTED',
      title = COALESCE(payload->>'title', title),
      summary = COALESCE(payload->>'summary', summary),
      document_url = COALESCE(payload->>'document_url', document_url)
    WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_versions (opi_id, title, summary, document_url)
    VALUES (oid, result->>'title', result->>'summary', result->>'document_url');

  WHEN 'changes' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'feedback') IS NULL OR trim(payload->>'feedback') = '' THEN RAISE EXCEPTION 'feedback required'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'CHANGES_REQUESTED' WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_feedback (opi_id, feedback, decision) VALUES (oid, payload->>'feedback', 'CHANGES_REQUESTED');

  WHEN 'reject' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'feedback') IS NULL OR trim(payload->>'feedback') = '' THEN RAISE EXCEPTION 'feedback required'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'REJECTED' WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_feedback (opi_id, feedback, decision) VALUES (oid, payload->>'feedback', 'REJECTED');

  WHEN 'approve' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'APPROVED' WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    IF (payload->>'feedback') IS NOT NULL AND trim(payload->>'feedback') != '' THEN
      INSERT INTO opi_feedback (opi_id, feedback, decision) VALUES (oid, payload->>'feedback', 'APPROVED');
    END IF;

  WHEN 'reopen' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'SUBMITTED' WHERE id = oid AND status IN ('APPROVED', 'REJECTED')
    RETURNING to_jsonb(opis.*) INTO result;

  WHEN 'convert' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'both permissions required'; END IF;
    oid := (payload->>'id')::uuid;
    INSERT INTO outreach_events (title, description, location, starts_at, ends_at, season_id)
    VALUES (
      payload->>'title', payload->>'description', payload->>'location',
      (payload->>'starts_at')::timestamptz, (payload->>'ends_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1))
    ) RETURNING id INTO oid;
    UPDATE opis SET status = 'CONVERTED', event_id = oid WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(opis.*) INTO result;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$$;

-- =============================================
-- 4. build_action RPC
-- =============================================
CREATE OR REPLACE FUNCTION build_action(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  sid uuid;
  rid uuid;
  r record;
  tok text;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'location' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'id') IS NOT NULL THEN
      UPDATE build_locations SET name = payload->>'name' WHERE id = (payload->>'id')::uuid
      RETURNING to_jsonb(build_locations.*) INTO result;
    ELSE
      INSERT INTO build_locations (name) VALUES (payload->>'name')
      RETURNING to_jsonb(build_locations.*) INTO result;
    END IF;

  WHEN 'session' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO build_sessions (title, location_id, opens_at, closes_at, season_id)
    VALUES (
      payload->>'title',
      (payload->>'location_id')::uuid,
      (payload->>'opens_at')::timestamptz,
      (payload->>'closes_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1))
    ) RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'edit_session' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    sid := (payload->>'id')::uuid;
    UPDATE build_sessions SET
      title = COALESCE(payload->>'title', title),
      location_id = COALESCE((payload->>'location_id')::uuid, location_id),
      opens_at = COALESCE((payload->>'opens_at')::timestamptz, opens_at),
      closes_at = COALESCE((payload->>'closes_at')::timestamptz, closes_at)
    WHERE id = sid
    RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'cancel' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE build_sessions SET cancelled = true WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'qr' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    sid := (payload->>'session_id')::uuid;
    tok := encode(gen_random_bytes(16), 'hex');
    result := jsonb_build_object('token', tok, 'expires_at', now() + interval '45 seconds', 'session_id', sid);

  WHEN 'check_in' THEN
    sid := (payload->>'session_id')::uuid;
    SELECT * INTO r FROM build_sessions WHERE id = sid;
    IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
    IF r.cancelled THEN RAISE EXCEPTION 'session cancelled'; END IF;
    IF now() < r.opens_at OR (r.closes_at IS NOT NULL AND now() > r.closes_at) THEN
      RAISE EXCEPTION 'session not in window';
    END IF;
    SELECT * INTO r FROM build_records WHERE session_id = sid AND member_id = uid AND check_out IS NULL;
    IF FOUND THEN
      result := to_jsonb(r);
      RETURN result;
    END IF;
    IF EXISTS (SELECT 1 FROM build_records WHERE member_id = uid AND check_out IS NULL) THEN
      RAISE EXCEPTION 'already checked in to another session';
    END IF;
    INSERT INTO build_records (session_id, member_id, check_in, checkout_method)
    VALUES (sid, uid, now(), 'qr')
    RETURNING to_jsonb(build_records.*) INTO result;

  WHEN 'check_out' THEN
    rid := (payload->>'id')::uuid;
    SELECT * INTO r FROM build_records WHERE id = rid AND member_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'record not found'; END IF;
    IF r.check_out IS NOT NULL THEN
      result := to_jsonb(r);
      RETURN result;
    END IF;
    UPDATE build_records SET
      check_out = now(),
      credited_minutes = EXTRACT(EPOCH FROM (now() - check_in))::integer / 60
    WHERE id = rid
    RETURNING to_jsonb(build_records.*) INTO result;

  WHEN 'correct' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'id') IS NOT NULL THEN
      rid := (payload->>'id')::uuid;
      UPDATE build_records SET
        check_in = COALESCE((payload->>'check_in')::timestamptz, check_in),
        check_out = COALESCE((payload->>'check_out')::timestamptz, check_out),
        credited_minutes = EXTRACT(EPOCH FROM (
          COALESCE((payload->>'check_out')::timestamptz, check_out) -
          COALESCE((payload->>'check_in')::timestamptz, check_in)
        ))::integer / 60,
        checkout_method = 'administrative'
      WHERE id = rid
      RETURNING to_jsonb(build_records.*) INTO result;
    ELSE
      INSERT INTO build_records (session_id, member_id, check_in, check_out, checkout_method, credited_minutes)
      VALUES (
        (payload->>'session_id')::uuid,
        (payload->>'member_id')::uuid,
        (payload->>'check_in')::timestamptz,
        (payload->>'check_out')::timestamptz,
        'administrative',
        EXTRACT(EPOCH FROM ((payload->>'check_out')::timestamptz - (payload->>'check_in')::timestamptz))::integer / 60
      ) RETURNING to_jsonb(build_records.*) INTO result;
    END IF;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$$;

-- =============================================
-- 5. Ensure grants
-- =============================================
GRANT EXECUTE ON FUNCTION outreach_action(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION opi_action(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION build_action(jsonb) TO authenticated;

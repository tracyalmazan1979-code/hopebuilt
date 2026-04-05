-- Seed recurring meetings from 2026-04-08 through 2026-06-30
-- Skips any row that already exists (same org + date + type + state + title).
--
-- Schedule:
--   Wed 9:00 AM CST — PMSI PreDoc Review             (predoc_pmsi, TX)
--   Wed 10:00 AM CST — IDEA Internal PreDoc Review   (predoc_idea, TX)
--   Wed 2:30 PM CST — IDEA TX F&C Doc Rev            (fac_doc_rev, TX)
--   Thu 11:00 AM CST — IPS F&C Doc Rev (combined)    (fac_doc_rev, IPS_FL)
--   Thu 11:00 AM CST — IPS F&C Tactical (combined)   (tactical,   IPS_FL)
--   Thu 11:30 AM CST — IDEA TX F&C Tactical          (tactical,   TX)

DO $$
DECLARE
  v_org_id  uuid;
  v_date    date;
  v_end     date := DATE '2026-06-30';
  v_start   date := DATE '2026-04-08';  -- first Wednesday on/after today
  v_dow     int;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE active = true ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active organization found';
  END IF;

  v_date := v_start;
  WHILE v_date <= v_end LOOP
    v_dow := EXTRACT(DOW FROM v_date);  -- 0=Sun, 3=Wed, 4=Thu

    -- Wednesday meetings
    IF v_dow = 3 THEN
      -- PMSI PreDoc 9:00 AM
      INSERT INTO meetings (org_id, meeting_date, meeting_type, state, title)
      SELECT v_org_id, v_date, 'predoc_pmsi', 'TX',
             'PMSI PreDoc Review — ' || to_char(v_date, 'FMMonth DD, YYYY') || ' (9:00 AM CST)'
      WHERE NOT EXISTS (
        SELECT 1 FROM meetings
        WHERE org_id = v_org_id AND meeting_date = v_date
          AND meeting_type = 'predoc_pmsi' AND state = 'TX'
      );

      -- IDEA Internal PreDoc 10:00 AM
      INSERT INTO meetings (org_id, meeting_date, meeting_type, state, title)
      SELECT v_org_id, v_date, 'predoc_idea', 'TX',
             'IDEA Internal PreDoc Review — ' || to_char(v_date, 'FMMonth DD, YYYY') || ' (10:00 AM CST)'
      WHERE NOT EXISTS (
        SELECT 1 FROM meetings
        WHERE org_id = v_org_id AND meeting_date = v_date
          AND meeting_type = 'predoc_idea' AND state = 'TX'
      );

      -- IDEA TX Doc Rev 2:30 PM
      INSERT INTO meetings (org_id, meeting_date, meeting_type, state, title)
      SELECT v_org_id, v_date, 'fac_doc_rev', 'TX',
             'Facilities and Construction Doc Rev — ' || to_char(v_date, 'FMMonth DD, YYYY') || ' (2:30 PM CST)'
      WHERE NOT EXISTS (
        SELECT 1 FROM meetings
        WHERE org_id = v_org_id AND meeting_date = v_date
          AND meeting_type = 'fac_doc_rev' AND state = 'TX'
      );
    END IF;

    -- Thursday meetings
    IF v_dow = 4 THEN
      -- IPS Doc Rev (combined) 11:00 AM
      INSERT INTO meetings (org_id, meeting_date, meeting_type, state, title)
      SELECT v_org_id, v_date, 'fac_doc_rev', 'IPS_FL',
             'IPS F&C Doc Rev (Combined) — ' || to_char(v_date, 'FMMonth DD, YYYY') || ' (11:00 AM CST)'
      WHERE NOT EXISTS (
        SELECT 1 FROM meetings
        WHERE org_id = v_org_id AND meeting_date = v_date
          AND meeting_type = 'fac_doc_rev' AND state = 'IPS_FL'
      );

      -- IPS Tactical (combined) 11:00 AM
      INSERT INTO meetings (org_id, meeting_date, meeting_type, state, title)
      SELECT v_org_id, v_date, 'tactical', 'IPS_FL',
             'IPS F&C Tactical (Combined) — ' || to_char(v_date, 'FMMonth DD, YYYY') || ' (11:00 AM CST)'
      WHERE NOT EXISTS (
        SELECT 1 FROM meetings
        WHERE org_id = v_org_id AND meeting_date = v_date
          AND meeting_type = 'tactical' AND state = 'IPS_FL'
      );

      -- IDEA TX Tactical 11:30 AM
      INSERT INTO meetings (org_id, meeting_date, meeting_type, state, title)
      SELECT v_org_id, v_date, 'tactical', 'TX',
             'IDEA TX F&C Tactical — ' || to_char(v_date, 'FMMonth DD, YYYY') || ' (11:30 AM CST)'
      WHERE NOT EXISTS (
        SELECT 1 FROM meetings
        WHERE org_id = v_org_id AND meeting_date = v_date
          AND meeting_type = 'tactical' AND state = 'TX'
      );
    END IF;

    v_date := v_date + 1;
  END LOOP;
END $$;

-- Verification: show count of meetings created per type
SELECT meeting_type, state, COUNT(*) AS meetings
FROM meetings
WHERE meeting_date BETWEEN DATE '2026-04-08' AND DATE '2026-06-30'
GROUP BY meeting_type, state
ORDER BY meeting_type, state;

-- Migration 012: seed the 3 courses and their language-variant subjects.
--
-- Courses:  Gita Foundation (GF, 2 subjects), Bhakti Shastri (BS, 4), Bhakti Vaibhav (BV, 5)
-- Each subject exists in 3 languages: English (-E), Hindi (-H), Telugu (-T).
-- Codes: GF1-E, GF1-H, GF1-T, GF2-*, BS1-E..BS4-T, BV1-E..BV5-T  (33 subjects total)

DO $$
DECLARE
  ay_id UUID;
  c_id  UUID;
  i     INT;
  sub_num INT;
  lang  RECORD;
  course_codes  TEXT[] := ARRAY['GF','BS','BV'];
  course_names  TEXT[] := ARRAY['Gita Foundation','Bhakti Shastri','Bhakti Vaibhav'];
  course_counts INT[]  := ARRAY[2,4,5];
BEGIN
  -- Resolve (or create) an academic year to attach subjects to.
  SELECT id INTO ay_id FROM academic_years WHERE is_current = true ORDER BY start_date DESC LIMIT 1;
  IF ay_id IS NULL THEN
    SELECT id INTO ay_id FROM academic_years ORDER BY start_date DESC LIMIT 1;
  END IF;
  IF ay_id IS NULL THEN
    INSERT INTO academic_years (label, start_date, end_date, is_current)
    VALUES ('2025-2026', '2025-06-01', '2026-05-31', true)
    RETURNING id INTO ay_id;
  END IF;

  -- Courses (idempotent by code)
  FOR i IN 1..array_length(course_codes, 1) LOOP
    INSERT INTO courses (name, code, duration_years)
    VALUES (course_names[i], course_codes[i], 1)
    ON CONFLICT (code) DO NOTHING;
  END LOOP;

  -- Subjects: course × subject-number × language
  FOR i IN 1..array_length(course_codes, 1) LOOP
    SELECT id INTO c_id FROM courses WHERE code = course_codes[i];
    FOR sub_num IN 1..course_counts[i] LOOP
      FOR lang IN
        SELECT * FROM (VALUES ('E','English'), ('H','Hindi'), ('T','Telugu')) AS t(sfx, lname)
      LOOP
        INSERT INTO subjects (code, name, course_id, academic_year_id, credits, semester_number)
        VALUES (
          course_codes[i] || sub_num || '-' || lang.sfx,
          course_names[i] || ' ' || sub_num || ' (' || lang.lname || ')',
          c_id, ay_id, 3, sub_num
        )
        ON CONFLICT (code) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

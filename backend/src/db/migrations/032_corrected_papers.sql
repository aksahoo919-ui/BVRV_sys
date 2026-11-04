-- Migration 032: corrected exam papers (scanned/photographed answer sheets).
--
-- Approved 04 Nov 2026 (Lakshminadh Prabhu's grievance-handling plan):
-- 1. Teachers and admin can both upload corrected papers, multiple files per
--    mark entry (a semester's worth of papers across Gita Foundation's 4
--    semesters / Bhakti Shastri's 6 semesters adds up, but storage is sized
--    for that separately — not a schema concern).
-- 2. Students never see this section (no student routes reference this table).
-- 3. Grievance / mark revision: the old file(s) are deleted and the new
--    corrected paper is uploaded in their place, with marks updated to match.
--    Only the latest version is kept — no retention table needed.
--
-- One mark entry (student+subject+semester+assessment) can have multiple
-- files (e.g. a multi-page scan).

CREATE TABLE IF NOT EXISTS corrected_papers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mark_id     UUID NOT NULL REFERENCES marks(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corrected_papers_mark ON corrected_papers(mark_id);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { query } from '../config/db.js';
import { logAudit } from '../middleware/audit.js';

// Corrected exam papers (scanned/photographed answer sheets), approved 04 Nov
// 2026 — Lakshminadh Prabhu's grievance-handling plan. Teachers and admin
// upload/replace them against a specific marks row (one mark can have
// several files, e.g. a multi-page scan). Students never see this: no
// student routes reference this controller. Stored on local disk under
// backend/uploads/corrected-papers, same convention as devoteePhoto.js, but
// served through an authenticated download endpoint rather than the public
// /api/uploads static mount — these are exam papers, not profile photos.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PAPERS_ROOT = path.join(__dirname, '../../uploads/corrected-papers');
fs.mkdirSync(PAPERS_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PAPERS_ROOT),
  filename: (req, file, cb) => {
    const markId = req.body.mark_id || 'unknown';
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 6);
    cb(null, `${markId}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export const papersUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 10MB per file, 10 files per request
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) return cb(new Error('Only PDF, JPG, PNG or WEBP files are allowed'));
    cb(null, true);
  },
});

function unlinkQuiet(filePath) {
  fs.unlink(filePath, () => {});
}

// Resolves a marks row and, unless the actor is admin, verifies they are the
// instructor of its subject (the same ownership check editMark/getMarksForSubject use).
async function resolveMarkForActor(markId, user) {
  const r = await query(
    `SELECT m.id, m.subject_id, m.student_id
     FROM marks m WHERE m.id = $1`,
    [markId]
  );
  if (!r.rows.length) return { error: 404, message: 'Mark not found' };
  const mark = r.rows[0];
  if (user.role === 'admin') return { mark };

  const owned = await query(
    'SELECT 1 FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [mark.subject_id, user.id]
  );
  if (!owned.rows.length) return { error: 403, message: 'Not your subject' };
  return { mark };
}

function unlinkFilesFor(rows) {
  for (const row of rows) {
    if (row.file_url?.startsWith('/corrected-papers/')) {
      unlinkQuiet(path.join(PAPERS_ROOT, path.basename(row.file_url)));
    }
  }
}

// POST /{teacher,admin}/corrected-papers  — body: mark_id, files[]
export async function uploadCorrectedPapers(req, res) {
  const { mark_id } = req.body;
  if (!mark_id) { (req.files || []).forEach(f => unlinkQuiet(f.path)); return res.status(400).json({ error: 'mark_id required' }); }
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const { error, message, mark } = await resolveMarkForActor(mark_id, req.user);
  if (error) { req.files.forEach(f => unlinkQuiet(f.path)); return res.status(error).json({ error: message }); }

  const inserted = [];
  for (const f of req.files) {
    const url = `/corrected-papers/${f.filename}`;
    const r = await query(
      `INSERT INTO corrected_papers (id, mark_id, file_url, file_name, uploaded_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id, file_name, uploaded_at`,
      [mark_id, url, f.originalname, req.user.id]
    );
    inserted.push(r.rows[0]);
  }
  await logAudit(req.user.id, 'upload_corrected_paper', 'marks', mark_id, { count: inserted.length, student_id: mark.student_id });
  res.status(201).json(inserted);
}

// GET /{teacher,admin}/corrected-papers/mark/:mark_id
export async function listCorrectedPapersForMark(req, res) {
  const { mark_id } = req.params;
  const { error, message } = await resolveMarkForActor(mark_id, req.user);
  if (error) return res.status(error).json({ error: message });

  const r = await query(
    `SELECT cp.id, cp.file_name, cp.uploaded_at, u.name AS uploaded_by_name
     FROM corrected_papers cp LEFT JOIN users u ON u.id = cp.uploaded_by
     WHERE cp.mark_id = $1 ORDER BY cp.uploaded_at`,
    [mark_id]
  );
  res.json(r.rows);
}

// GET /{teacher,admin}/corrected-papers/:id/file
export async function downloadCorrectedPaper(req, res) {
  const r = await query(
    `SELECT cp.*, m.subject_id FROM corrected_papers cp JOIN marks m ON m.id = cp.mark_id WHERE cp.id = $1`,
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'File not found' });
  const row = r.rows[0];

  if (req.user.role !== 'admin') {
    const owned = await query(
      'SELECT 1 FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
      [row.subject_id, req.user.id]
    );
    if (!owned.rows.length) return res.status(403).json({ error: 'Not your subject' });
  }

  const abs = path.join(PAPERS_ROOT, path.basename(row.file_url));
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File missing on disk' });
  res.download(abs, row.file_name);
}

// DELETE /{teacher,admin}/corrected-papers/:id
export async function deleteCorrectedPaper(req, res) {
  const r = await query(
    `SELECT cp.*, m.subject_id, m.student_id FROM corrected_papers cp JOIN marks m ON m.id = cp.mark_id WHERE cp.id = $1`,
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'File not found' });
  const row = r.rows[0];

  if (req.user.role !== 'admin') {
    const owned = await query(
      'SELECT 1 FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
      [row.subject_id, req.user.id]
    );
    if (!owned.rows.length) return res.status(403).json({ error: 'Not your subject' });
  }

  await query('DELETE FROM corrected_papers WHERE id=$1', [row.id]);
  unlinkFilesFor([row]);
  await logAudit(req.user.id, 'delete_corrected_paper', 'marks', row.mark_id, { student_id: row.student_id });
  res.json({ success: true });
}

// POST /{teacher,admin}/corrected-papers/replace — grievance flow.
// Body: mark_id, scored_marks? (optional — updates the mark to match the
// re-checked paper), files[]. Removes every existing file for the mark and
// replaces them with the new upload in one step; only the latest version is
// ever kept on disk.
export async function replaceCorrectedPapers(req, res) {
  const { mark_id, scored_marks } = req.body;
  if (!mark_id) { (req.files || []).forEach(f => unlinkQuiet(f.path)); return res.status(400).json({ error: 'mark_id required' }); }
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const { error, message, mark } = await resolveMarkForActor(mark_id, req.user);
  if (error) { req.files.forEach(f => unlinkQuiet(f.path)); return res.status(error).json({ error: message }); }

  if (scored_marks != null && scored_marks !== '') {
    const scored = Number(scored_marks);
    if (isNaN(scored) || scored < 0) {
      req.files.forEach(f => unlinkQuiet(f.path));
      return res.status(400).json({ error: 'scored_marks must be a non-negative number' });
    }
    await query(
      `UPDATE marks SET scored_marks=$1, uploaded_by=$2, uploaded_at=NOW() WHERE id=$3`,
      [scored, req.user.id, mark_id]
    );
  }

  const existing = await query('SELECT * FROM corrected_papers WHERE mark_id=$1', [mark_id]);
  await query('DELETE FROM corrected_papers WHERE mark_id=$1', [mark_id]);
  unlinkFilesFor(existing.rows);

  const inserted = [];
  for (const f of req.files) {
    const url = `/corrected-papers/${f.filename}`;
    const r = await query(
      `INSERT INTO corrected_papers (id, mark_id, file_url, file_name, uploaded_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id, file_name, uploaded_at`,
      [mark_id, url, f.originalname, req.user.id]
    );
    inserted.push(r.rows[0]);
  }
  await logAudit(req.user.id, 'replace_corrected_paper', 'marks', mark_id, {
    student_id: mark.student_id, replaced_count: existing.rows.length, new_count: inserted.length,
    scored_marks: scored_marks ?? null,
  });
  res.json({ files: inserted, scored_marks: scored_marks ?? null });
}

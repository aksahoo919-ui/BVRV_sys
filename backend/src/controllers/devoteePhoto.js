import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { query } from '../config/db.js';
import { logAudit } from '../middleware/audit.js';

// Profile photo upload for a devotee — requested 27 Oct 2026 by Lakshminadh
// Prabhu ("Photo upload in each profile"). Stored on local disk under
// backend/uploads/avatars and served at /api/uploads/avatars/<file> (mounted
// in index.js), so it rides the existing /api reverse-proxy path and needs no
// extra nginx config on the VPS. avatar_url is the column every profile view
// already renders (Google OAuth avatars used the same column before).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const AVATARS_DIR = path.join(UPLOADS_ROOT, 'avatars');
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 5);
    cb(null, `${req.params.student_id}-${Date.now()}${ext}`);
  },
});

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const photoUpload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) return cb(new Error('Only JPG, PNG or WEBP images are allowed'));
    cb(null, true);
  },
});

async function applyPhotoUpload(req, res, studentId) {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  const before = await query(`SELECT avatar_url FROM users WHERE id=$1 AND role='student'`, [studentId]);
  if (!before.rows.length) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Devotee not found' });
  }

  const url = `/api/uploads/avatars/${req.file.filename}`;
  const r = await query(
    `UPDATE users SET avatar_url=$1 WHERE id=$2 RETURNING id, name, avatar_url`,
    [url, studentId]
  );

  // Clean up the previous file, but only ever delete our own uploads.
  const old = before.rows[0].avatar_url;
  if (old && old.startsWith('/api/uploads/avatars/')) {
    const oldPath = path.join(UPLOADS_ROOT, 'avatars', path.basename(old));
    fs.unlink(oldPath, () => {});
  }

  await logAudit(req.user.id, 'update_devotee_photo', 'user', studentId, { by_role: req.user.role });
  res.json(r.rows[0]);
}

// POST /api/teacher/students/:student_id/photo
export async function teacherUploadDevoteePhoto(req, res) {
  const { student_id } = req.params;
  const mine = await query(
    `SELECT 1 FROM class_enrollments s
       JOIN class_enrollments t ON t.subject_id = s.subject_id AND t.instructor_id = $2
      WHERE s.student_id = $1 LIMIT 1`,
    [student_id, req.user.id]
  );
  if (!mine.rows.length) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(403).json({ error: 'This devotee is not in any of your classes' });
  }
  return applyPhotoUpload(req, res, student_id);
}

// POST /api/mentor/students/:student_id/photo
export async function mentorUploadDevoteePhoto(req, res) {
  const { student_id } = req.params;
  const mine = await query(
    'SELECT 1 FROM class_mentor_assignments WHERE mentor_id = $1 AND student_id = $2 LIMIT 1',
    [req.user.id, student_id]
  );
  if (!mine.rows.length) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(403).json({ error: 'This devotee is not one of your members' });
  }
  return applyPhotoUpload(req, res, student_id);
}

// POST /api/admin/users/:student_id/photo
export async function adminUploadDevoteePhoto(req, res) {
  return applyPhotoUpload(req, res, req.params.student_id);
}

import { query } from '../config/db.js';
import { logAudit } from '../middleware/audit.js';

// ── Mentor directory (Mentors > BVRV Mentors / BV Mentors) ─────────────────
// Row name/phone/email/coordinator_* hold admin-typed values; when empty the
// linked account's values are shown, so the list follows All Users.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['bvrv', 'bv'];
const LANGUAGES = ['English', 'Hindi', 'Telugu'];

const SELECT = `
  SELECT md.id, md.kind, md.user_id, md.subject_id, md.language, md.coordinator_user_id,
    COALESCE(NULLIF(md.name, ''),  u.name)  AS name,
    COALESCE(NULLIF(md.phone, ''), u.phone) AS phone,
    COALESCE(NULLIF(md.email, ''), u.email) AS email,
    s.code AS course_code, s.name AS course_name,
    sem.id AS semester_id, COALESCE(sem.label, 'Sem ' || sem.number) AS semester_label,
    to_char(sem.start_date, 'YYYY-MM-DD') AS semester_start, to_char(sem.end_date, 'YYYY-MM-DD') AS semester_end,
    (sem.id IS NULL OR sem.is_current) AS semester_is_current,
    COALESCE(NULLIF(md.coordinator_name, ''),  cu.name)  AS coordinator_name,
    COALESCE(NULLIF(md.coordinator_phone, ''), cu.phone) AS coordinator_phone,
    md.updated_at
  FROM mentor_directory md
  LEFT JOIN users u    ON u.id  = md.user_id
  LEFT JOIN users cu   ON cu.id = md.coordinator_user_id
  LEFT JOIN subjects s ON s.id  = md.subject_id
  LEFT JOIN semesters sem ON sem.id = s.semester_id`;

const clean = v => (v == null ? null : String(v).trim() || null);

// ── Coordinator check ──────────────────────────────────────────────────────
// A typed coordinator (name + phone, no account picked) is looked up in the
// portal by phone. If exactly one account has that number it is linked; when
// several do, the one that is a BV member under this BV Leader wins. The result
// says whether the coordinator is in the portal and in that leader's members.
const digits10 = p => String(p || '').replace(/\D/g, '').slice(-10);

async function findCoordinatorAccount(phone, leaderUserId) {
  const p10 = digits10(phone);
  if (p10.length !== 10) return { status: 'not_found' };
  const r = await query(`
    SELECT u.id, u.name, u.phone, u.role,
      EXISTS (SELECT 1 FROM class_mentor_assignments cma WHERE cma.student_id = u.id AND cma.mentor_id = $2) AS member_of_leader
    FROM users u
    WHERE u.status = 'active' AND right(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 10) = $1
    ORDER BY u.name`, [p10, leaderUserId || null]);
  if (!r.rows.length) return { status: 'not_found' };
  let pick = r.rows.length === 1 ? r.rows[0] : null;
  if (!pick) {
    const members = r.rows.filter(x => x.member_of_leader);
    if (members.length === 1) pick = members[0];
  }
  if (!pick) return { status: 'ambiguous', candidates: r.rows.map(x => x.name) };
  return { status: 'linked', id: pick.id, account_name: pick.name, member_of_leader: pick.member_of_leader };
}

// GET /admin/mentor-directory?kind=bvrv|bv
async function listMentors(req, res) {
  const { kind } = req.query;
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'kind must be bvrv or bv' });
  const r = await query(`${SELECT} WHERE md.kind = $1
    ORDER BY ${kind === 'bvrv' ? 's.code NULLS LAST, sem.start_date DESC NULLS LAST' : 'md.language NULLS LAST'}, 7`, [kind]);
  res.json(r.rows);
}

// GET /admin/mentor-directory/options — people for the mentor / coordinator pickers
async function mentorOptions(req, res) {
  const r = await query(`
    SELECT id, name, phone, email, role, secondary_role
    FROM users
    WHERE status = 'active'
    ORDER BY (role = 'student' AND secondary_role IS NULL), name`);
  res.json(r.rows);
}

// Validate + normalise a create/update body. Typed name/phone/email equal to the
// linked account's value are stored as NULL so they keep following the account.
async function readBody(body, kind) {
  const user_id = clean(body.user_id);
  let coordinator_user_id = clean(body.coordinator_user_id);
  const subject_id = clean(body.subject_id);
  const language = clean(body.language);
  for (const [k, v] of Object.entries({ user_id, coordinator_user_id, subject_id }))
    if (v && !UUID_RE.test(v)) return { error: `Invalid ${k}` };
  if (language && !LANGUAGES.includes(language)) return { error: 'Language must be English, Hindi or Telugu' };

  let name = clean(body.name), phone = clean(body.phone), email = clean(body.email);
  let coordinator_name = clean(body.coordinator_name), coordinator_phone = clean(body.coordinator_phone);
  if (!user_id && !name) return { error: 'Pick a mentor or type a name' };
  if (kind === 'bvrv' && !subject_id) return { error: 'Pick the course ID (class)' };

  const ids = [user_id, coordinator_user_id].filter(Boolean);
  const users = ids.length ? (await query('SELECT id, name, phone, email FROM users WHERE id = ANY($1)', [ids])).rows : [];
  const byId = Object.fromEntries(users.map(u => [u.id, u]));
  if (user_id && !byId[user_id]) return { error: 'Mentor account not found' };
  if (coordinator_user_id && !byId[coordinator_user_id]) return { error: 'Coordinator account not found' };
  const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  if (user_id) {
    const u = byId[user_id];
    if (same(name, u.name)) name = null;
    if (same(phone, u.phone)) phone = null;
    if (same(email, u.email)) email = null;
  }
  let coordinator_check = null;
  // a linked account whose number differs from the typed one is a different person: drop the link and look again
  if (coordinator_user_id && coordinator_phone && digits10(byId[coordinator_user_id].phone) && digits10(coordinator_phone) !== digits10(byId[coordinator_user_id].phone))
    coordinator_user_id = null;
  if (!coordinator_user_id && coordinator_phone) {
    // typed coordinator: is this devotee already in the portal (and under this leader)?
    coordinator_check = await findCoordinatorAccount(coordinator_phone, user_id);
    if (coordinator_check.status === 'linked') {
      // mapped to the portal account: the list then shows the account's own name and mobile, not what was typed
      coordinator_user_id = coordinator_check.id;
      coordinator_name = null; coordinator_phone = null;
    }
  } else if (coordinator_user_id) {
    const c = byId[coordinator_user_id];
    if (same(coordinator_name, c.name)) coordinator_name = null;
    if (same(coordinator_phone, c.phone)) coordinator_phone = null;
    const m = user_id ? (await query('SELECT 1 FROM class_mentor_assignments WHERE mentor_id = $1 AND student_id = $2 LIMIT 1', [user_id, coordinator_user_id])).rows.length : 0;
    coordinator_check = { status: 'linked', id: coordinator_user_id, account_name: c.name, member_of_leader: !!m };
  }
  return { coordinator_check, row: { user_id, name, phone, email, subject_id: kind === 'bvrv' ? subject_id : null,
    language: kind === 'bv' ? language : null, coordinator_user_id, coordinator_name, coordinator_phone } };
}

const dupError = err => (err.code === '23505'
  ? 'This mentor is already listed for that course / language' : null);

// POST /admin/mentor-directory  { kind, ...fields }
async function createMentor(req, res) {
  const { kind } = req.body;
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'kind must be bvrv or bv' });
  const { row, error, coordinator_check } = await readBody(req.body, kind);
  if (error) return res.status(400).json({ error });
  try {
    const r = await query(
      `INSERT INTO mentor_directory (kind, user_id, name, phone, email, subject_id, language,
         coordinator_user_id, coordinator_name, coordinator_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [kind, row.user_id, row.name, row.phone, row.email, row.subject_id, row.language,
       row.coordinator_user_id, row.coordinator_name, row.coordinator_phone]);
    await logAudit(req.user.id, 'create', 'mentor_directory', r.rows[0].id, { kind, ...row });
    const out = await query(`${SELECT} WHERE md.id = $1`, [r.rows[0].id]);
    res.status(201).json({ ...out.rows[0], coordinator_check });
  } catch (err) {
    const msg = dupError(err); if (msg) return res.status(409).json({ error: msg });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid mentor, coordinator or course' });
    throw err;
  }
}

// PATCH /admin/mentor-directory/:id
async function updateMentor(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const cur = await query('SELECT kind FROM mentor_directory WHERE id = $1', [id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'Mentor not found' });
  const { kind } = cur.rows[0];
  const { row, error, coordinator_check } = await readBody(req.body, kind);
  if (error) return res.status(400).json({ error });
  try {
    await query(
      `UPDATE mentor_directory SET user_id=$2, name=$3, phone=$4, email=$5, subject_id=$6, language=$7,
         coordinator_user_id=$8, coordinator_name=$9, coordinator_phone=$10, updated_at=NOW()
       WHERE id=$1`,
      [id, row.user_id, row.name, row.phone, row.email, row.subject_id, row.language,
       row.coordinator_user_id, row.coordinator_name, row.coordinator_phone]);
    await logAudit(req.user.id, 'update', 'mentor_directory', id, { kind, ...row });
    const out = await query(`${SELECT} WHERE md.id = $1`, [id]);
    res.json({ ...out.rows[0], coordinator_check });
  } catch (err) {
    const msg = dupError(err); if (msg) return res.status(409).json({ error: msg });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid mentor, coordinator or course' });
    throw err;
  }
}

// DELETE /admin/mentor-directory/:id  (removes the listing only, never the user account)
async function deleteMentor(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const r = await query('DELETE FROM mentor_directory WHERE id = $1 RETURNING kind, user_id', [id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Mentor not found' });
  await logAudit(req.user.id, 'delete', 'mentor_directory', id, r.rows[0]);
  res.json({ message: 'Removed from the list' });
}

// POST /admin/mentor-directory/coordinator  { ids: [...], coordinator_user_id | coordinator_name + coordinator_phone }
async function setCoordinator(req, res) {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(x => UUID_RE.test(x)) : [];
  if (!ids.length) return res.status(400).json({ error: 'Select at least one mentor' });
  const coordinator_user_id = clean(req.body.coordinator_user_id);
  if (coordinator_user_id && !UUID_RE.test(coordinator_user_id)) return res.status(400).json({ error: 'Invalid coordinator' });
  let coordinator_name = clean(req.body.coordinator_name), coordinator_phone = clean(req.body.coordinator_phone);
  if (coordinator_user_id) {
    const c = (await query('SELECT name, phone FROM users WHERE id = $1', [coordinator_user_id])).rows[0];
    if (!c) return res.status(400).json({ error: 'Coordinator account not found' });
    if ((coordinator_name || '').toLowerCase() === (c.name || '').toLowerCase()) coordinator_name = null;
    if ((coordinator_phone || '') === (c.phone || '')) coordinator_phone = null;
  }
  const checks = { linked: 0, linked_members: 0, not_found: 0, ambiguous: 0 };
  let updated = 0;
  for (const id of ids) {
    let uid = coordinator_user_id, cname = coordinator_name, cphone = coordinator_phone;
    const row = (await query('SELECT user_id FROM mentor_directory WHERE id = $1', [id])).rows[0];
    if (!row) continue;
    if (!uid && cphone) {
      const m = await findCoordinatorAccount(cphone, row.user_id);
      if (m.status === 'linked') { uid = m.id; cname = null; cphone = null; checks.linked++; if (m.member_of_leader) checks.linked_members++; }
      else checks[m.status]++;
    }
    await query(
      `UPDATE mentor_directory SET coordinator_user_id=$2, coordinator_name=$3, coordinator_phone=$4, updated_at=NOW() WHERE id = $1`,
      [id, uid, cname, cphone]);
    updated++;
  }
  await logAudit(req.user.id, 'set_coordinator', 'mentor_directory', null,
    { count: updated, coordinator_user_id, coordinator_name, coordinator_phone, ...checks });
  res.json({ updated, ...checks });
}

// Express 4 does not catch async errors: answer 500 instead of leaving the request hanging.
const safe = fn => async (req, res) => {
  try { await fn(req, res); } catch (err) { console.error(err); if (!res.headersSent) res.status(500).json({ error: 'Server error' }); }
};
export const listMentorsSafe = safe(listMentors);
export const mentorOptionsSafe = safe(mentorOptions);
export const createMentorSafe = safe(createMentor);
export const updateMentorSafe = safe(updateMentor);
export const deleteMentorSafe = safe(deleteMentor);
export const setCoordinatorSafe = safe(setCoordinator);

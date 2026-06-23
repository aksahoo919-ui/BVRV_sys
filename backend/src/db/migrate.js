import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = [
  '001_init.sql',
  '002_extensions.sql',
  '003_extend_tables.sql',
  '004_merge_instructor.sql',
  '005_remove_semesters.sql',
  '006_fix_user_fk_cascades.sql',
  '007_fix_remaining_fk.sql',
  '008_marks_assessment_text.sql',
  '009_results_course.sql',
  '010_class_mentors_attendance.sql',
  '011_student_contacts.sql',
  '012_seed_courses_subjects.sql',
  '013_secondary_role.sql',
  '014_semester_and_mentor_pin.sql',
  '015_performance_indexes.sql',
];

async function migrate() {
  // Create tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of migrations) {
    // Skip if already applied
    const check = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file]
    );
    if (check.rows.length > 0) {
      console.log(`  ↩ ${file} already applied — skipping`);
      continue;
    }

    console.log(`Running ${file}…`);
    const sql = readFileSync(join(__dirname, 'migrations', file), 'utf8');
    try {
      await pool.query(sql);
      await pool.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
      console.log(`  ✓ ${file} done`);
    } catch (err) {
      console.error(`  ✗ ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('All migrations completed.');
  await pool.end();
}

migrate();

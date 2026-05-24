# BVRV Attendance System

Full-stack college attendance management with Google OAuth, role-based access, and automated grading.

## Tech Stack
- **Backend**: Node.js (ESM), Express, PostgreSQL (Supabase), Redis (optional)
- **Frontend**: React 18, Vite, Tailwind CSS, React Router v6
- **Auth**: Google OAuth 2.0 (no username/password)
- **PDF**: pdfkit | **Excel**: exceljs | **Email**: nodemailer

## Quick Start

### Prerequisites
- Node.js 18+, npm
- PostgreSQL (Supabase recommended) or local Postgres
- Google OAuth credentials

### Setup
```bash
# Clone and install
git clone ... && cd bvrv_attendance
cd backend && npm install
cd ../frontend && npm install

# Configure backend
cp backend/.env.example backend/.env
# Edit .env with your DATABASE_URL, Google OAuth credentials, etc.

# Run migrations
cd backend && npm run migrate

# Seed demo data
npm run seed

# Start backend (dev)
npm run dev

# Start frontend (separate terminal)
cd ../frontend && npm run dev
```

## Roles

| Role | Description |
|------|-------------|
| **admin** | Full access: users, subjects, enrollments, results, settings |
| **teacher** | Manage attendance sessions, enter marks, view defaulters |
| **mentor** | Monitor assigned students: attendance, GPA, alerts, messages |
| **student** | View own attendance, marks, results, timetable |

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| SESSION_SECRET | Express session secret (64-char hex) |
| JWT_SECRET | JWT signing secret |
| HMAC_SECRET | HMAC-SHA256 attendance PIN secret |
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| GOOGLE_CALLBACK_URL | `http://localhost:5000/api/auth/google/callback` |
| ADMIN_GMAIL | Gmail address for the seeded admin account |

### Optional (Email)
| Variable | Description |
|----------|-------------|
| SMTP_HOST | SMTP server (e.g. smtp.gmail.com) |
| SMTP_PORT | Usually 587 |
| SMTP_USER | SMTP username |
| SMTP_PASS | SMTP password / app password |
| FROM_EMAIL | Sender address |

## Key Features

### Attendance
- Teachers start sessions with HMAC-SHA256 PIN
- Students mark attendance during active session window
- Admin/teacher can submit corrections (reviewed by admin)

### Grade & GPA System
Grades are configured in Admin → Settings (grade_boundaries JSON):
- Default: S≥90%, A≥80%, B≥70%, C≥60%, D≥50%, F<50%
- GPA calculated on configurable scale (default 10.0)
- Step-based: highest grade = scale value, each lower grade = −1, F = 0
- Credit-weighted GPA per semester; CGPA = mean of semester GPAs

### Results Workflow
1. Admin enters marks (or teacher enters via Marks page)
2. Admin → Results → **Generate Results** for a semester
3. System computes per-student GPA, CGPA, rank, stores in `results` table
4. Admin reviews, then clicks **Publish** — students can now view their report cards
5. PDF report cards available for download by students and admin

### Mentor Assignment Flow
1. Admin → Mentor Assignments → assign mentor to student
2. Mentor sees assigned students on their dashboard
3. Mentor receives email alerts for: low attendance, low GPA (thresholds in Settings)
4. Mentor can send messages and add counseling notes

### Backup & Restore
- Admin → Backups → **Create Backup** — generates JSON snapshot of all tables
- Download via the backup list
- To restore: use the JSON data to re-import (manual SQL or custom script)

## Development

### Running Migrations
```bash
cd backend && npm run migrate
```
Migration files are in `backend/src/db/migrations/`. They run in order and are idempotent.

### Seeding
```bash
cd backend && npm run seed
```
Creates demo users (admin, teachers, students, mentor), subjects, timetable, marks, and results.

### Project Structure
```
bvrv_attendance/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── routes/          # Express routers
│   │   ├── middleware/       # Auth, role checks
│   │   ├── services/        # gradeService, reportService, emailService
│   │   ├── db/
│   │   │   ├── migrations/  # SQL migration files
│   │   │   ├── migrate.js   # Migration runner
│   │   │   └── seed.js      # Demo data seeder
│   │   └── index.js         # App entry point
│   └── .env
└── frontend/
    └── src/
        ├── pages/
        │   ├── admin/
        │   ├── teacher/
        │   ├── mentor/
        │   └── student/
        ├── components/
        └── context/
```

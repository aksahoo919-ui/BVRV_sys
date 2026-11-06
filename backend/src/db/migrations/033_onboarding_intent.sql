-- Migration 033: capture what a new signup intends to join, so the admin
-- Approvals screen has something to decide on.
--
-- Lakshminadh Prabhu, 6 Nov 2026 (WhatsApp): "As of now not showing many
-- details to approve or reject the request. We need information like for
-- which class he is joining as student and also any BV leader information."
--
-- Before this, onboarding only captured a role (student/teacher/mentor/admin)
-- via POST /auth/onboarding — there was nowhere to say which class or BV
-- Leader a new student intends to join, so the Approvals table had nothing
-- to show. These two columns are the signup-time *intent* only: approving a
-- user does NOT auto-create a class_enrollments / class_mentor_assignments
-- row from them (that's a separate, deliberate admin action after approval,
-- unchanged by this migration).
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_mentor_id UUID REFERENCES users(id) ON DELETE SET NULL;

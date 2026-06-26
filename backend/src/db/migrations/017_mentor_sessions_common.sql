-- Migration 017: BV Leader (mentor) sessions are a single common class for all
-- the leader's students, not tied to a subject. Make subject_id optional.

ALTER TABLE mentor_sessions ALTER COLUMN subject_id DROP NOT NULL;

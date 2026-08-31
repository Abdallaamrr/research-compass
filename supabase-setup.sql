-- ============================================================
-- ResearchHub — Complete Production-Ready Schema
-- Use this in Supabase SQL Editor for a fresh install.
-- For existing databases, run the migration file instead:
--   supabase/migrations/20260813000000_optimize.sql
-- ============================================================

-- ============================================================
-- DROP existing tables for a clean reinstall (idempotent)
DROP TABLE IF EXISTS "project"              CASCADE;
DROP TABLE IF EXISTS "shot_comments"        CASCADE;
DROP TABLE IF EXISTS "meeting_participants"  CASCADE;
DROP TABLE IF EXISTS "phase_members"        CASCADE;
DROP TABLE IF EXISTS "event_attendees"      CASCADE;
DROP TABLE IF EXISTS "activity"             CASCADE;
DROP TABLE IF EXISTS "phases"               CASCADE;
DROP TABLE IF EXISTS "events"               CASCADE;
DROP TABLE IF EXISTS "meetings"             CASCADE;
DROP TABLE IF EXISTS "links"                CASCADE;
DROP TABLE IF EXISTS "files"                CASCADE;
DROP TABLE IF EXISTS "voiceNotes"           CASCADE;
DROP TABLE IF EXISTS "shots"                CASCADE;
DROP TABLE IF EXISTS "notes"                CASCADE;
DROP TABLE IF EXISTS "tasks"                CASCADE;
DROP TABLE IF EXISTS "papers"               CASCADE;
DROP TABLE IF EXISTS "members"              CASCADE;
DROP VIEW  IF EXISTS "recent_activity";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Members (users of the workspace)
CREATE TABLE "members" (
  "id"             TEXT        PRIMARY KEY,
  "name"           TEXT        NOT NULL,
  "initials"       TEXT        NOT NULL,
  "role"           TEXT        NOT NULL CHECK ("role" IN ('Team Leader', 'Researcher', 'Supervisor', 'Member')),
  "email"          TEXT        NOT NULL UNIQUE,
  "responsibilities" TEXT      NOT NULL DEFAULT '',
  "color"          TEXT        NOT NULL DEFAULT '220',
  "password"       TEXT        NOT NULL DEFAULT '',
  "uniId"          TEXT,
  "phone"          TEXT,
  "uniEmail"       TEXT,
  "cv"             TEXT,
  "privateEmail"   TEXT,
  "email_verified" BOOLEAN     NOT NULL DEFAULT false,
  "githubUsername" TEXT,
  "cv_storage_path" TEXT,
  "cv_mime_type"    TEXT,
  "cv_size_bytes"   BIGINT,
  "linkedinUrl"     TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Research Papers
CREATE TABLE "papers" (
  "id"          TEXT        PRIMARY KEY,
  "title"       TEXT        NOT NULL,
  "authors"     TEXT        NOT NULL,
  "year"        INTEGER     NOT NULL,
  "venue"       TEXT        NOT NULL DEFAULT '',
  "doi"         TEXT        NOT NULL DEFAULT '',
  "url"         TEXT        NOT NULL DEFAULT '',
  "category"    TEXT        NOT NULL DEFAULT '',
  "keywords"    JSONB       NOT NULL DEFAULT '[]',
  "abstract"    TEXT        NOT NULL DEFAULT '',
  "status"      TEXT        NOT NULL DEFAULT 'To Read'
                CHECK ("status" IN ('To Read', 'Reading', 'Analyzing', 'Completed', 'Important', 'Rejected')),
  "ownerId"     TEXT        NOT NULL REFERENCES "members"("id") ON DELETE SET NULL,
  "progress"    INTEGER     NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
  "analysis"    JSONB       NOT NULL DEFAULT '{}',
  "storage_path" TEXT,
  "mime_type"    TEXT,
  "size_bytes"   BIGINT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks (Kanban board)
CREATE TABLE "tasks" (
  "id"           TEXT        PRIMARY KEY,
  "title"        TEXT        NOT NULL,
  "description"  TEXT        NOT NULL DEFAULT '',
  "status"       TEXT        NOT NULL DEFAULT 'todo'
                 CHECK ("status" IN ('backlog', 'todo', 'progress', 'review', 'done')),
  "priority"     TEXT        NOT NULL DEFAULT 'MEDIUM'
                 CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  "assigneeId"   TEXT        NOT NULL REFERENCES "members"("id") ON DELETE SET NULL,
  "due"          TEXT        NOT NULL DEFAULT '',
  "labels"       JSONB       NOT NULL DEFAULT '[]',
  "checklist"    JSONB       NOT NULL DEFAULT '[]',
  "paperId"      TEXT        REFERENCES "papers"("id")  ON DELETE SET NULL,
  "phaseId"      TEXT,
  "comments"     INTEGER     NOT NULL DEFAULT 0,
  "attachments"  INTEGER     NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notes
CREATE TABLE "notes" (
  "id"          TEXT        PRIMARY KEY,
  "title"       TEXT        NOT NULL,
  "type"        TEXT        NOT NULL DEFAULT 'Research'
                CHECK ("type" IN ('Research', 'Meeting', 'Idea', 'Literature Review', 'Experiment', 'Brainstorm')),
  "authorId"    TEXT        NOT NULL REFERENCES "members"("id") ON DELETE SET NULL,
  "updated"     TEXT        NOT NULL DEFAULT '',
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "tags"        JSONB       NOT NULL DEFAULT '[]',
  "body"        TEXT        NOT NULL DEFAULT '',
  "paperId"     TEXT        REFERENCES "papers"("id") ON DELETE SET NULL,
  "taskId"      TEXT        REFERENCES "tasks"("id")  ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Screenshots
CREATE TABLE "shots" (
  "id"          TEXT        PRIMARY KEY,
  "title"       TEXT        NOT NULL,
  "description" TEXT        NOT NULL DEFAULT '',
  "tags"        JSONB       NOT NULL DEFAULT '[]',
  "source"      TEXT        NOT NULL DEFAULT '',
  "uploadedBy"  TEXT        NOT NULL REFERENCES "members"("id") ON DELETE SET NULL,
  "date"        TEXT        NOT NULL DEFAULT '',
  "paperId"     TEXT        REFERENCES "papers"("id") ON DELETE SET NULL,
  "hue"         INTEGER     NOT NULL DEFAULT 220,
  "comments"    JSONB       NOT NULL DEFAULT '[]',
  "url"         TEXT,
  "storage_path" TEXT,
  "mime_type"    TEXT,
  "size_bytes"   BIGINT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shot Comments (normalized from shots.comments JSONB)
CREATE TABLE "shot_comments" (
  "id"          TEXT        PRIMARY KEY,
  "shot_id"     TEXT        NOT NULL REFERENCES "shots"("id")   ON DELETE CASCADE,
  "author_id"   TEXT        NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "text"        TEXT        NOT NULL CHECK (char_length("text") > 0),
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voice Notes
CREATE TABLE "voiceNotes" (
  "id"          TEXT        PRIMARY KEY,
  "title"       TEXT        NOT NULL,
  "seconds"     INTEGER     NOT NULL DEFAULT 0,
  "authorId"    TEXT        NOT NULL REFERENCES "members"("id") ON DELETE SET NULL,
  "date"        TEXT        NOT NULL DEFAULT '',
  "description" TEXT        NOT NULL DEFAULT '',
  "paperId"     TEXT        REFERENCES "papers"("id") ON DELETE SET NULL,
  "taskId"      TEXT        REFERENCES "tasks"("id")  ON DELETE SET NULL,
  "url"         TEXT,
  "storage_path" TEXT,
  "mime_type"    TEXT,
  "size_bytes"   BIGINT,
  "meetingId"    TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Files
CREATE TABLE "files" (
  "id"          TEXT        PRIMARY KEY,
  "name"        TEXT        NOT NULL,
  "ext"         TEXT        NOT NULL DEFAULT '',
  "folder"      TEXT        NOT NULL DEFAULT 'General',
  "size"        TEXT        NOT NULL DEFAULT '',
  "uploadedBy"  TEXT        NOT NULL REFERENCES "members"("id") ON DELETE SET NULL,
  "date"        TEXT        NOT NULL DEFAULT '',
  "url"         TEXT,
  "storage_path" TEXT,
  "mime_type"    TEXT,
  "size_bytes"   BIGINT,
  "paperId"      TEXT REFERENCES "papers"("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resource Links
CREATE TABLE "links" (
  "id"          TEXT        PRIMARY KEY,
  "title"       TEXT        NOT NULL,
  "url"         TEXT        NOT NULL,
  "description" TEXT        NOT NULL DEFAULT '',
  "category"    TEXT        NOT NULL DEFAULT 'General',
  "tags"        JSONB       NOT NULL DEFAULT '[]',
  "addedBy"     TEXT        NOT NULL REFERENCES "members"("id") ON DELETE SET NULL,
  "paperId"     TEXT        REFERENCES "papers"("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meetings
CREATE TABLE "meetings" (
  "id"          TEXT        PRIMARY KEY,
  "title"       TEXT        NOT NULL,
  "date"        TEXT        NOT NULL DEFAULT '',
  "time"        TEXT        NOT NULL DEFAULT '',
  "participants" JSONB      NOT NULL DEFAULT '[]',
  "agenda"      JSONB       NOT NULL DEFAULT '[]',
  "decisions"   JSONB       NOT NULL DEFAULT '[]',
  "actionItems" JSONB       NOT NULL DEFAULT '[]',
  "notes"       TEXT        NOT NULL DEFAULT '',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meeting Participants (junction table — normalizes meetings.participants)
CREATE TABLE "meeting_participants" (
  "meeting_id"  TEXT NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
  "member_id"   TEXT NOT NULL REFERENCES "members"("id")  ON DELETE CASCADE,
  PRIMARY KEY ("meeting_id", "member_id")
);

-- Calendar Events
CREATE TABLE "events" (
  "id"          TEXT        PRIMARY KEY,
  "title"       TEXT        NOT NULL,
  "date"        TEXT        NOT NULL DEFAULT '',
  "time"        TEXT        NOT NULL DEFAULT '',
  "kind"        TEXT        NOT NULL DEFAULT 'meeting'
                CHECK ("kind" IN ('meeting', 'deadline', 'milestone', 'personal')),
  "description" TEXT        NOT NULL DEFAULT '',
  "attendees"   JSONB       NOT NULL DEFAULT '[]',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Attendees (junction table — normalizes events.attendees)
CREATE TABLE "event_attendees" (
  "event_id"    TEXT NOT NULL REFERENCES "events"("id")   ON DELETE CASCADE,
  "member_id"   TEXT NOT NULL REFERENCES "members"("id")  ON DELETE CASCADE,
  PRIMARY KEY ("event_id", "member_id")
);

-- Research Roadmap Phases
CREATE TABLE "phases" (
  "id"           TEXT        PRIMARY KEY,
  "index"        INTEGER     NOT NULL,
  "name"         TEXT        NOT NULL,
  "start"        TEXT        NOT NULL DEFAULT '',
  "end"          TEXT        NOT NULL DEFAULT '',
  "progress"     INTEGER     NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
  "members"      JSONB       NOT NULL DEFAULT '[]',
  "deliverables" JSONB       NOT NULL DEFAULT '[]',
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase Members (junction table — normalizes phases.members)
CREATE TABLE "phase_members" (
  "phase_id"    TEXT NOT NULL REFERENCES "phases"("id")  ON DELETE CASCADE,
  "member_id"   TEXT NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  PRIMARY KEY ("phase_id", "member_id")
);

-- Project Details
CREATE TABLE "project" (
  "id"          TEXT        PRIMARY KEY,
  "name"        TEXT        NOT NULL,
  "topic"       TEXT        NOT NULL,
  "institution" TEXT        NOT NULL,
  "phase"       TEXT        NOT NULL,
  "progress"    INTEGER     NOT NULL
);

-- Seed with initial project details
INSERT INTO "project" ("id", "name", "topic", "institution", "phase", "progress")
VALUES ('default', 'SehatMasr', 'Ontology-Driven Clinical NLP for Early Sepsis Risk Detection', 'Faculty of Computing · Graduation Research Group 07', 'Phase 3 · Dataset Collection', 46)
ON CONFLICT ("id") DO NOTHING;

-- Activity Log
CREATE TABLE "activity" (
  "id"          TEXT        PRIMARY KEY,
  "memberId"    TEXT        NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "action"      TEXT        NOT NULL,
  "object"      TEXT        NOT NULL,
  "time"        TEXT        NOT NULL DEFAULT '',
  "kind"        TEXT        NOT NULL DEFAULT 'task'
                CHECK ("kind" IN ('paper', 'task', 'note', 'file', 'voice', 'image', 'comment')),
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- members
CREATE INDEX "idx_members_email"      ON "members" ("email");
CREATE INDEX "idx_members_role"       ON "members" ("role");

-- papers
CREATE INDEX "idx_papers_owner"       ON "papers" ("ownerId");
CREATE INDEX "idx_papers_status"      ON "papers" ("status");
CREATE INDEX "idx_papers_year"        ON "papers" ("year" DESC);
CREATE INDEX "idx_papers_category"    ON "papers" ("category");
CREATE INDEX "idx_papers_created"     ON "papers" ("created_at" DESC);

-- tasks
CREATE INDEX "idx_tasks_assignee"     ON "tasks" ("assigneeId");
CREATE INDEX "idx_tasks_status"       ON "tasks" ("status");
CREATE INDEX "idx_tasks_priority"     ON "tasks" ("priority");
CREATE INDEX "idx_tasks_paper"        ON "tasks" ("paperId");
CREATE INDEX "idx_tasks_phase"        ON "tasks" ("phaseId");
CREATE INDEX "idx_tasks_due"          ON "tasks" ("due");
CREATE INDEX "idx_tasks_created"      ON "tasks" ("created_at" DESC);

-- notes
CREATE INDEX "idx_notes_author"       ON "notes" ("authorId");
CREATE INDEX "idx_notes_paper"        ON "notes" ("paperId");
CREATE INDEX "idx_notes_task"         ON "notes" ("taskId");
CREATE INDEX "idx_notes_updated"      ON "notes" ("updated_at" DESC);
CREATE INDEX "idx_notes_type"         ON "notes" ("type");

-- shots
CREATE INDEX "idx_shots_paper"        ON "shots" ("paperId");
CREATE INDEX "idx_shots_uploader"     ON "shots" ("uploadedBy");
CREATE INDEX "idx_shots_created"      ON "shots" ("created_at" DESC);

-- shot_comments
CREATE INDEX "idx_shot_cmt_shot"      ON "shot_comments" ("shot_id");
CREATE INDEX "idx_shot_cmt_author"    ON "shot_comments" ("author_id");
CREATE INDEX "idx_shot_cmt_created"   ON "shot_comments" ("created_at" DESC);

-- voiceNotes
CREATE INDEX "idx_voice_author"       ON "voiceNotes" ("authorId");
CREATE INDEX "idx_voice_paper"        ON "voiceNotes" ("paperId");
CREATE INDEX "idx_voice_task"         ON "voiceNotes" ("taskId");
CREATE INDEX "idx_voice_meeting"      ON "voiceNotes" ("meetingId");
CREATE INDEX "idx_voice_created"      ON "voiceNotes" ("created_at" DESC);

-- files
CREATE INDEX "idx_files_folder"       ON "files" ("folder");
CREATE INDEX "idx_files_uploader"     ON "files" ("uploadedBy");
CREATE INDEX "idx_files_ext"          ON "files" ("ext");
CREATE INDEX "idx_files_paper"        ON "files" ("paperId");
CREATE INDEX "idx_files_created"      ON "files" ("created_at" DESC);

-- links
CREATE INDEX "idx_links_category"     ON "links" ("category");
CREATE INDEX "idx_links_paper"        ON "links" ("paperId");
CREATE INDEX "idx_links_adder"        ON "links" ("addedBy");
CREATE INDEX "idx_links_created"      ON "links" ("created_at" DESC);

-- meetings
CREATE INDEX "idx_meetings_date"      ON "meetings" ("date");
CREATE INDEX "idx_meetings_created"   ON "meetings" ("created_at" DESC);
CREATE INDEX "idx_mtg_part_member"    ON "meeting_participants" ("member_id");
CREATE INDEX "idx_mtg_part_meeting"   ON "meeting_participants" ("meeting_id");

-- events
CREATE INDEX "idx_events_date"        ON "events" ("date");
CREATE INDEX "idx_events_kind"        ON "events" ("kind");
CREATE INDEX "idx_events_created"     ON "events" ("created_at" DESC);
CREATE INDEX "idx_evt_att_member"     ON "event_attendees" ("member_id");
CREATE INDEX "idx_evt_att_event"      ON "event_attendees" ("event_id");

-- phases
CREATE INDEX "idx_phases_index"       ON "phases" ("index" ASC);
CREATE INDEX "idx_phases_progress"    ON "phases" ("progress");
CREATE INDEX "idx_phase_mem_member"   ON "phase_members" ("member_id");
CREATE INDEX "idx_phase_mem_phase"    ON "phase_members" ("phase_id");

-- activity
CREATE INDEX "idx_activity_member"    ON "activity" ("memberId");
CREATE INDEX "idx_activity_kind"      ON "activity" ("kind");
CREATE INDEX "idx_activity_created"   ON "activity" ("created_at" DESC);

-- ============================================================
-- ATOMIC FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION toggle_checklist_item(p_task_id TEXT, p_index INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "tasks"
  SET "checklist" = jsonb_set(
    "checklist",
    ARRAY[p_index::text, 'done'],
    (NOT ("checklist"->p_index->>'done')::boolean)::text::jsonb
  )
  WHERE "id" = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_paper_analysis(p_paper_id TEXT, p_section TEXT, p_value TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "papers"
  SET "analysis" = jsonb_set(COALESCE("analysis", '{}'::jsonb), ARRAY[p_section], to_jsonb(p_value))
  WHERE "id" = p_paper_id;
END;
$$;

-- ============================================================
-- RECENT ACTIVITY VIEW (paginated — last 100 records)
-- ============================================================
CREATE OR REPLACE VIEW "recent_activity" AS
  SELECT * FROM "activity"
  ORDER BY "created_at" DESC
  LIMIT 100;

-- ============================================================
-- GRANT PERMISSIONS (shared access — no RLS)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "members"              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "papers"               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tasks"                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "notes"                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "shots"                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "shot_comments"        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "voiceNotes"           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "files"                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "links"                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "meetings"             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "meeting_participants"  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "event_attendees"      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "phases"               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "phase_members"        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "activity"             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "project"              TO anon, authenticated;
GRANT SELECT                          ON "recent_activity"      TO anon, authenticated;

-- ============================================================
-- ENABLE PERMISSIVE RLS POLICIES ON ALL TABLES
-- ============================================================
ALTER TABLE "members"              ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "members"              FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "papers"               ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "papers"               FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "tasks"                ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "tasks"                FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "notes"                ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "notes"                FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "shots"                ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "shots"                FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "shot_comments"        ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "shot_comments"        FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "voiceNotes"           ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "voiceNotes"           FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "files"                ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "files"                FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "links"                ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "links"                FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "meetings"             ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "meetings"             FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "meeting_participants"  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "meeting_participants"  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "events"               ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "events"               FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "event_attendees"      ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "event_attendees"      FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "phases"               ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "phases"               FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "phase_members"        ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "phase_members"        FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "activity"             ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "activity"             FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "project"              ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive Policy" ON "project"              FOR ALL TO public USING (true) WITH CHECK (true);

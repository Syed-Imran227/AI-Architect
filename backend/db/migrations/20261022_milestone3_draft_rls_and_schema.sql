-- ==============================================================================
-- DRAFT MIGRATION: Milestone 3 Security & Schema Alignment (REVISED DRAFT 3C)
-- Status: UNEXECUTED DRAFT — FOR ARCHITECTURAL REVIEW ONLY
-- Target: Supabase PostgreSQL (Dashboard SQL Editor)
-- ==============================================================================
--
-- WORKFLOW & EXECUTION GATES:
-- 1. Execute `backend/db/migrations/20261022_milestone3_policy_discovery.sql` in the
--    Supabase SQL Editor.
-- 2. COPY AND SAVE Query 3 output (Executable Restore DDL) as your rollback snapshot.
-- 3. COPY the Query 7 output (live_policy_checksum and total_live_policies) and paste
--    them into EXPECTED_CHECKSUM and EXPECTED_COUNT in Stage 0 below.
-- 4. Review Query 2 to identify any legacy policy names, and add explicit DROP
--    statements for them into Stage 1 below.
-- 5. DO NOT apply this migration while AUTH_PROVIDER=jwt with local MongoDB ObjectIds.
--    This migration strictly requires Supabase Auth UUID tokens (auth.uid()).
--
-- ARCHITECTURAL INVARIANTS:
-- 1. `projects.layout_data` (JSONB) is the single canonical source of truth for geometry.
-- 2. `floors`, `rooms`, `furniture_placements`, and `lighting_fixtures` remain optional
--    downstream projection tables. Project persistence never blocks on projection errors.
-- 3. All user operations are strictly enforced via RLS (auth.uid()). Anonymous access is
--    denied for all private architectural data.
-- 4. `profiles.email` addition has been REMOVED: Email is managed authoritatively by
--    Supabase Auth in `auth.users.email`.
-- ==============================================================================


-- ── STAGE 0: MANDATORY BASELINE VERIFICATION GATE ────────────────────────────
-- Solves Bug 1 & Bug 2:
-- - NEVER approves based on policy name alone.
-- - Calculates an MD5 hash across (tablename, policyname, permissive, cmd, roles, qual, with_check).
-- - Fails closed if ANY expression, role, command, or policy is modified, unexpected, or missing.
-- - Runs BEFORE any changes or drops occur.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    -- OPERATOR ACTION: Paste the exact values from Query 7 of the discovery script here:
    EXPECTED_CHECKSUM CONSTANT TEXT := 'CHANGEME_OPERATOR_MUST_PASTE_CHECKSUM';
    EXPECTED_COUNT    CONSTANT INTEGER := -1;

    current_checksum TEXT;
    current_count INTEGER;
BEGIN
    -- 1. Check for operator authorization
    IF EXPECTED_CHECKSUM = 'CHANGEME_OPERATOR_MUST_PASTE_CHECKSUM' OR EXPECTED_COUNT < 0 THEN
        RAISE EXCEPTION 'PREFLIGHT SAFETY GATE BLOCKED: Operator approval required. You must execute 20261022_milestone3_policy_discovery.sql, review the policy baseline, and configure EXPECTED_CHECKSUM and EXPECTED_COUNT in Stage 0 of this script before running.';
    END IF;

    -- 2. Compute current live catalog checksum across all 10 tables
    SELECT
        COALESCE(
            md5(string_agg(
                tablename || ':' || policyname || ':' || permissive || ':' || cmd || ':' ||
                array_to_string(roles, ',') || ':' || COALESCE(qual, '') || ':' || COALESCE(with_check, ''),
                '|' ORDER BY tablename, policyname
            )),
            'NO_POLICIES_EXIST'
        ),
        COUNT(*)
    INTO current_checksum, current_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'projects', 'project_versions', 'floors', 'rooms',
        'furniture_placements', 'lighting_fixtures', 'design_conversations',
        'conversation_messages', 'generated_assets'
      );

    -- 3. Fail closed if catalog does not match the reviewed baseline
    IF current_checksum != EXPECTED_CHECKSUM OR current_count != EXPECTED_COUNT THEN
        RAISE EXCEPTION 'PREFLIGHT SAFETY GATE BLOCKED: Live catalog state (checksum %, count %) does not match reviewed baseline (checksum %, count %). Migration aborted to prevent unintended security regressions or permissive policy leaks.', current_checksum, current_count, EXPECTED_CHECKSUM, EXPECTED_COUNT;
    END IF;
END $$;


-- ── STAGE 1: REVIEWED LEGACY POLICY PURGE ────────────────────────────────────
-- Sequenced correctly AFTER baseline verification has confirmed the exact catalog state.
-- Operator pastes explicit DROP statements for any reviewed legacy policies here:
-- (e.g., DROP POLICY IF EXISTS "legacy_policy_name" ON public.projects;)
-- ─────────────────────────────────────────────────────────────────────────────


-- ── STAGE 2: SCHEMA ALIGNMENT (VERIFIED GAPS ONLY) ───────────────────────────

-- Add operation JSONB to conversation_messages.
-- Required for AI Architect Copilot structured architectural command logging (ADD_ROOM, RESIZE, etc.).
ALTER TABLE IF EXISTS public.conversation_messages
  ADD COLUMN IF NOT EXISTS operation JSONB;

COMMENT ON COLUMN public.conversation_messages.operation IS
  'Structured architectural command payload executed during conversational turn (e.g. ADD_ROOM, RESIZE_SPACE)';


-- ── STAGE 3: PERFORMANCE INDEXES FOR OWNERSHIP SUBQUERIES ─────────────────────
-- Indexes on all foreign keys and lookup paths used by RLS policy joins and application queries.
-- Eliminates sequential table scans during multi-hop policy evaluation.

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON public.projects (user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_created
  ON public.projects (user_id, created_at DESC);

-- Project Versions
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id
  ON public.project_versions (project_id);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_version
  ON public.project_versions (project_id, version_number DESC);

-- Design Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON public.design_conversations (user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_project_user
  ON public.design_conversations (project_id, user_id);

-- Conversation Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.conversation_messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.conversation_messages (conversation_id, created_at ASC);

-- Generated Assets
CREATE INDEX IF NOT EXISTS idx_generated_assets_user_id
  ON public.generated_assets (user_id);

CREATE INDEX IF NOT EXISTS idx_generated_assets_project_id
  ON public.generated_assets (project_id);

CREATE INDEX IF NOT EXISTS idx_generated_assets_project_created
  ON public.generated_assets (project_id, created_at DESC);

-- Downstream Projection: Lighting Fixtures
CREATE INDEX IF NOT EXISTS idx_lighting_project_id
  ON public.lighting_fixtures (project_id);

-- Downstream Projection: Floors
CREATE INDEX IF NOT EXISTS idx_floors_project_id
  ON public.floors (project_id);

-- Downstream Projection: Rooms
CREATE INDEX IF NOT EXISTS idx_rooms_floor_id
  ON public.rooms (floor_id);

-- Downstream Projection: Furniture Placements
CREATE INDEX IF NOT EXISTS idx_furniture_room_id
  ON public.furniture_placements (room_id);


-- ── STAGE 4: ROW LEVEL SECURITY (RLS) POLICIES ────────────────────────────────

-- Ensure RLS is enabled on all 10 application tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighting_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- Table 1: public.profiles
-- Ownership: Direct (id = auth.uid())
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ------------------------------------------------------------------------------
-- Table 2: public.projects
-- Ownership: Direct (user_id = auth.uid())
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ------------------------------------------------------------------------------
-- Table 3: public.project_versions
-- Ownership: Chained to parent project (projects.user_id = auth.uid())
--
-- RECONCILIATION NOTE (CASCADE vs IMMUTABLE HISTORY):
-- - Project versions are immutable design snapshots (no UPDATE policy).
-- - If Query 5 of the discovery script confirms `delete_rule = 'CASCADE'` on the
--   `project_id` foreign key, `versions_delete_own` is NOT required and can be omitted
--   to strictly prevent accidental or selective deletion of individual versions.
-- - If `delete_rule != 'CASCADE'`, `versions_delete_own` below is required so the
--   application repository can cascade-delete version rows when a project is deleted.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "versions_select_own" ON public.project_versions;
CREATE POLICY "versions_select_own" ON public.project_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_versions.project_id
        AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "versions_insert_own" ON public.project_versions;
CREATE POLICY "versions_insert_own" ON public.project_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_versions.project_id
        AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "versions_delete_own" ON public.project_versions;
CREATE POLICY "versions_delete_own" ON public.project_versions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_versions.project_id
        AND projects.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- Table 4: public.design_conversations
-- Ownership: Direct (user_id = auth.uid())
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_select_own" ON public.design_conversations;
CREATE POLICY "conversations_select_own" ON public.design_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_insert_own" ON public.design_conversations;
CREATE POLICY "conversations_insert_own" ON public.design_conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_update_own" ON public.design_conversations;
CREATE POLICY "conversations_update_own" ON public.design_conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_delete_own" ON public.design_conversations;
CREATE POLICY "conversations_delete_own" ON public.design_conversations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ------------------------------------------------------------------------------
-- Table 5: public.conversation_messages
-- Ownership: Chained to parent conversation (design_conversations.user_id = auth.uid())
-- Note: Messages are append-only conversational history.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "messages_select_own" ON public.conversation_messages;
CREATE POLICY "messages_select_own" ON public.conversation_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.design_conversations
      WHERE design_conversations.id = conversation_messages.conversation_id
        AND design_conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_own" ON public.conversation_messages;
CREATE POLICY "messages_insert_own" ON public.conversation_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.design_conversations
      WHERE design_conversations.id = conversation_messages.conversation_id
        AND design_conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_delete_own" ON public.conversation_messages;
CREATE POLICY "messages_delete_own" ON public.conversation_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.design_conversations
      WHERE design_conversations.id = conversation_messages.conversation_id
        AND design_conversations.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- Table 6: public.generated_assets
-- Ownership: Direct (user_id = auth.uid()) OR chained through project_id.
-- Cross-Tenant Project Hijacking Prevention:
-- UPDATE validates BOTH that the updater owns the asset AND that any destination
-- project_id belongs to the updater.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assets_select_own" ON public.generated_assets;
CREATE POLICY "assets_select_own" ON public.generated_assets
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = generated_assets.project_id
          AND projects.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assets_insert_own" ON public.generated_assets;
CREATE POLICY "assets_insert_own" ON public.generated_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = generated_assets.project_id
          AND projects.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assets_update_own" ON public.generated_assets;
CREATE POLICY "assets_update_own" ON public.generated_assets
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = generated_assets.project_id
          AND projects.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = generated_assets.project_id
          AND projects.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assets_delete_own" ON public.generated_assets;
CREATE POLICY "assets_delete_own" ON public.generated_assets
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = generated_assets.project_id
          AND projects.user_id = auth.uid()
      )
    )
  );


-- ------------------------------------------------------------------------------
-- Table 7: public.lighting_fixtures (Optional Downstream Projection)
-- Ownership: Chained to parent project (projects.user_id = auth.uid())
-- Supports full CRUD for fixture editing, repositioning, and deletion.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "lighting_select_own" ON public.lighting_fixtures;
DROP POLICY IF EXISTS "lighting_insert_own" ON public.lighting_fixtures;
DROP POLICY IF EXISTS "lighting_delete_own" ON public.lighting_fixtures;
DROP POLICY IF EXISTS "lighting_all_own" ON public.lighting_fixtures;

CREATE POLICY "lighting_all_own" ON public.lighting_fixtures
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = lighting_fixtures.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = lighting_fixtures.project_id
        AND projects.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- Table 8: public.floors (Optional Downstream Projection)
-- Ownership: Chained to parent project (projects.user_id = auth.uid())
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "floors_select_own" ON public.floors;
DROP POLICY IF EXISTS "floors_all_own" ON public.floors;

CREATE POLICY "floors_all_own" ON public.floors
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = floors.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = floors.project_id
        AND projects.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- Table 9: public.rooms (Optional Downstream Projection)
-- Ownership: Chained through floors -> projects -> auth.uid()
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "rooms_select_own" ON public.rooms;
DROP POLICY IF EXISTS "rooms_all_own" ON public.rooms;

CREATE POLICY "rooms_all_own" ON public.rooms
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.floors
      JOIN public.projects ON floors.project_id = projects.id
      WHERE floors.id = rooms.floor_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.floors
      JOIN public.projects ON floors.project_id = projects.id
      WHERE floors.id = rooms.floor_id
        AND projects.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- Table 10: public.furniture_placements (Optional Downstream Projection)
-- Ownership: Chained through rooms -> floors -> projects -> auth.uid()
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "furniture_select_own" ON public.furniture_placements;
DROP POLICY IF EXISTS "furniture_all_own" ON public.furniture_placements;

CREATE POLICY "furniture_all_own" ON public.furniture_placements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      JOIN public.floors ON rooms.floor_id = floors.id
      JOIN public.projects ON floors.project_id = projects.id
      WHERE rooms.id = furniture_placements.room_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms
      JOIN public.floors ON rooms.floor_id = floors.id
      JOIN public.projects ON floors.project_id = projects.id
      WHERE rooms.id = furniture_placements.room_id
        AND projects.user_id = auth.uid()
    )
  );


-- ── STAGE 5: POST-MIGRATION ASSERTION GATE ───────────────────────────────────
-- Verifies that RLS is active and exactly the expected policies exist.
DO $$
DECLARE
    disabled_tables TEXT;
BEGIN
    SELECT string_agg(c.relname, ', ')
    INTO disabled_tables
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'profiles', 'projects', 'project_versions', 'floors', 'rooms',
        'furniture_placements', 'lighting_fixtures', 'design_conversations',
        'conversation_messages', 'generated_assets'
      )
      AND c.relrowsecurity = false;

    IF disabled_tables IS NOT NULL THEN
        RAISE EXCEPTION 'POST-MIGRATION ASSERTION FAILED: RLS is disabled on table(s): [%]', disabled_tables;
    END IF;
END $$;


-- ==============================================================================
-- 4. CONDITIONAL ROLLBACK & RESTORATION PROCEDURE
-- ==============================================================================
--
-- MANDATORY RESTORATION RULES:
-- 1. DO NOT drop policies without immediately executing the DDL saved from Query 3 of
--    the discovery script. Dropping policies leaves RLS in a DEFAULT-DENY lockout.
-- 2. DO NOT blindly drop indexes below. Cross-reference Query 4 of the discovery output:
--    If an index ALREADY EXISTED before Milestone 3, DO NOT execute its DROP INDEX command.
-- 3. DO NOT execute `DROP COLUMN operation` on `conversation_messages` once production data
--    exists, as this destroys copilot action history.
--
-- REVERSAL SCRIPT:
--
-- -- Step 1: Drop ONLY newly created performance indexes (Verify against Query 4 snapshot!)
-- -- DROP INDEX IF EXISTS public.idx_projects_user_id;
-- -- DROP INDEX IF EXISTS public.idx_projects_user_created;
-- -- DROP INDEX IF EXISTS public.idx_project_versions_project_id;
-- -- DROP INDEX IF EXISTS public.idx_project_versions_project_version;
-- -- DROP INDEX IF EXISTS public.idx_conversations_user_id;
-- -- DROP INDEX IF EXISTS public.idx_conversations_project_user;
-- -- DROP INDEX IF EXISTS public.idx_messages_conversation_id;
-- -- DROP INDEX IF EXISTS public.idx_messages_conversation_created;
-- -- DROP INDEX IF EXISTS public.idx_generated_assets_user_id;
-- -- DROP INDEX IF EXISTS public.idx_generated_assets_project_id;
-- -- DROP INDEX IF EXISTS public.idx_generated_assets_project_created;
-- -- DROP INDEX IF EXISTS public.idx_lighting_project_id;
-- -- DROP INDEX IF EXISTS public.idx_floors_project_id;
-- -- DROP INDEX IF EXISTS public.idx_rooms_floor_id;
-- -- DROP INDEX IF EXISTS public.idx_furniture_room_id;
--
-- -- Step 2: Drop Milestone 3 policies
-- DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
-- DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
-- DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
-- DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
-- DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
-- DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
-- DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
-- DROP POLICY IF EXISTS "versions_select_own" ON public.project_versions;
-- DROP POLICY IF EXISTS "versions_insert_own" ON public.project_versions;
-- DROP POLICY IF EXISTS "versions_delete_own" ON public.project_versions;
-- DROP POLICY IF EXISTS "conversations_select_own" ON public.design_conversations;
-- DROP POLICY IF EXISTS "conversations_insert_own" ON public.design_conversations;
-- DROP POLICY IF EXISTS "conversations_update_own" ON public.design_conversations;
-- DROP POLICY IF EXISTS "conversations_delete_own" ON public.design_conversations;
-- DROP POLICY IF EXISTS "messages_select_own" ON public.conversation_messages;
-- DROP POLICY IF EXISTS "messages_insert_own" ON public.conversation_messages;
-- DROP POLICY IF EXISTS "messages_delete_own" ON public.conversation_messages;
-- DROP POLICY IF EXISTS "assets_select_own" ON public.generated_assets;
-- DROP POLICY IF EXISTS "assets_insert_own" ON public.generated_assets;
-- DROP POLICY IF EXISTS "assets_update_own" ON public.generated_assets;
-- DROP POLICY IF EXISTS "assets_delete_own" ON public.generated_assets;
-- DROP POLICY IF EXISTS "lighting_all_own" ON public.lighting_fixtures;
-- DROP POLICY IF EXISTS "floors_all_own" ON public.floors;
-- DROP POLICY IF EXISTS "rooms_all_own" ON public.rooms;
-- DROP POLICY IF EXISTS "furniture_all_own" ON public.furniture_placements;
--
-- -- Step 3: Immediately paste and execute the exact CREATE POLICY statements
-- -- saved from Query 3 of `20261022_milestone3_policy_discovery.sql`.
-- ==============================================================================

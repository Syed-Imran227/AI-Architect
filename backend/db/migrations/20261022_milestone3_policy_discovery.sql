-- ==============================================================================
-- READ-ONLY POLICY DISCOVERY & AUDIT SCRIPT (PREFLIGHT FOR MILESTONE 3)
-- Status: READ-ONLY AUDIT — SAFE TO EXECUTE IN SUPABASE SQL EDITOR
-- Target: Supabase PostgreSQL (Dashboard SQL Editor)
-- Purpose: Inspect existing RLS status, policies, constraints, indexes, columns,
--          and compute a cryptographic policy baseline checksum across all 10 tables.
-- ==============================================================================
--
-- HOW TO RUN THIS IN THE SUPABASE SQL EDITOR:
-- 1. Open the Supabase Dashboard: https://supabase.com/dashboard/project/dxkehvifctxccwqgbpwb
-- 2. Click the "SQL Editor" icon in the left navigation sidebar.
-- 3. Click "New query".
-- 4. Paste the contents of this entire script into the query editor.
-- 5. Click "Run" (or press Ctrl+Enter / Cmd+Enter).
-- 6. Review the result tabs below the editor.
--
-- MANDATORY ARTIFACT PRESERVATION:
-- - COPY AND SAVE THE OUTPUT OF QUERY 3 (EXECUTABLE RESTORE DDL) to a local file.
--   This is your exact rollback baseline.
-- - COPY AND SAVE THE OUTPUT OF QUERY 7 (POLICY BASELINE CHECKSUM & COUNT).
--   These exact values must be pasted into Stage 0 of the migration script.
--
-- SAFETY CONTRACT:
-- - This script executes ONLY SELECT queries against PostgreSQL system catalogs.
-- - It modifies NO data, alters NO tables, and drops NO policies or indexes.
-- ==============================================================================


-- ── QUERY 1: RLS STATUS ACROSS ALL 10 APPLICATION TABLES ─────────────────────
-- Checks whether Row Level Security is currently enabled and enforced.
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'profiles',
    'projects',
    'project_versions',
    'floors',
    'rooms',
    'furniture_placements',
    'lighting_fixtures',
    'design_conversations',
    'conversation_messages',
    'generated_assets'
  )
ORDER BY c.relname;


-- ── QUERY 2: DETAILED LIVE POLICY DEFINITIONS (METADATA AUDIT) ────────────────
-- Inspects existing policy names, roles, commands, permissiveness, and expressions.
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'projects',
    'project_versions',
    'floors',
    'rooms',
    'furniture_placements',
    'lighting_fixtures',
    'design_conversations',
    'conversation_messages',
    'generated_assets'
  )
ORDER BY tablename, policyname;


-- ── QUERY 3: AUTOMATED EXECUTABLE POLICY BACKUP & RESTORE DDL GENERATOR ───────
-- Generates exact, ready-to-run CREATE POLICY statements to restore live policies
-- during a rollback. Accounts for quoted identifiers, roles, command, permissiveness,
-- USING expressions, and WITH CHECK expressions.
--
-- BACKUP GENERATOR LIMITATIONS & SCOPE:
-- - Handles: Standard single-table, join, and subquery expressions in PostgreSQL.
-- - Limitations: If a policy depends on custom stored procedures or user-defined
--   functions in another schema, those functions must exist when the restore DDL is run.
SELECT
    tablename,
    policyname,
    'CREATE POLICY ' || quote_ident(policyname) ||
    ' ON ' || quote_ident(schemaname) || '.' || quote_ident(tablename) ||
    ' AS ' || permissive ||
    ' FOR ' || cmd ||
    ' TO ' || array_to_string(roles, ', ') ||
    CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
    ';' AS executable_restore_ddl
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'projects',
    'project_versions',
    'floors',
    'rooms',
    'furniture_placements',
    'lighting_fixtures',
    'design_conversations',
    'conversation_messages',
    'generated_assets'
  )
ORDER BY tablename, policyname;


-- ── QUERY 4: EXISTING INDEXES SNAPSHOT ────────────────────────────────────────
-- Identifies pre-existing indexes. SAVE THIS OUTPUT: Any index listed here must
-- NOT be dropped during rollback, preventing accidental destruction of pre-existing
-- performance structures.
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'projects',
    'project_versions',
    'floors',
    'rooms',
    'furniture_placements',
    'lighting_fixtures',
    'design_conversations',
    'conversation_messages',
    'generated_assets'
  )
ORDER BY tablename, indexname;


-- ── QUERY 5: FOREIGN KEY CONSTRAINTS & REFERENTIAL CASCADE RULES ──────────────
-- Verifies physical relationships and identifies whether child tables (e.g. project_versions)
-- have ON DELETE CASCADE configured.
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'profiles',
    'projects',
    'project_versions',
    'floors',
    'rooms',
    'furniture_placements',
    'lighting_fixtures',
    'design_conversations',
    'conversation_messages',
    'generated_assets'
  )
ORDER BY tc.table_name, kcu.column_name;


-- ── QUERY 6: TABLE COLUMNS & DATA TYPES AUDIT ─────────────────────────────────
-- Verifies column names, physical types, nullability, and defaults across all 10 tables.
-- Confirms whether operation JSONB, user_id, or other required columns exist.
SELECT
    table_name,
    column_name,
    ordinal_position,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'projects',
    'project_versions',
    'floors',
    'rooms',
    'furniture_placements',
    'lighting_fixtures',
    'design_conversations',
    'conversation_messages',
    'generated_assets'
  )
ORDER BY table_name, ordinal_position;


-- ── QUERY 7: LIVE POLICY BASELINE CHECKSUM & COUNT ────────────────────────────
-- Computes a deterministic MD5 hash across all existing policy definitions
-- (tablename, policyname, permissive, roles, cmd, qual, with_check).
--
-- PURPOSE:
-- Guarantees that matching policy names alone are NEVER sufficient for approval.
-- If ANY policy expression, role, command, or rule is modified or added, this hash
-- will change. The operator must paste the output of this query into Stage 0 of the
-- migration script to unlock execution.
SELECT
    COALESCE(
        md5(string_agg(
            tablename || ':' || policyname || ':' || permissive || ':' || cmd || ':' ||
            array_to_string(roles, ',') || ':' || COALESCE(qual, '') || ':' || COALESCE(with_check, ''),
            '|' ORDER BY tablename, policyname
        )),
        'NO_POLICIES_EXIST'
    ) AS live_policy_checksum,
    COUNT(*) AS total_live_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'projects',
    'project_versions',
    'floors',
    'rooms',
    'furniture_placements',
    'lighting_fixtures',
    'design_conversations',
    'conversation_messages',
    'generated_assets'
  );

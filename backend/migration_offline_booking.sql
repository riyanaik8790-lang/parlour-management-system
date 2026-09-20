-- ============================================================
-- Migration: Offline / Walk-in Booking Support
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run — all statements are idempotent.
-- ============================================================

-- Step 1: Add offline customer columns to appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS offline_name  VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS offline_phone VARCHAR(20)  NULL;

-- Step 2: Make user_id nullable so offline rows have no account
--   First drop the NOT NULL constraint (no-op if already nullable)
ALTER TABLE appointments
  ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Verify the changes (optional - comment out after checking)
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'appointments'
-- ORDER BY ordinal_position;

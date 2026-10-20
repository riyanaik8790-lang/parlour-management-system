-- Migration: Add services_json and total_duration columns to appointments table
-- Run this once against your Supabase (Postgres) database.
-- Safe to run multiple times (column presence check via DO blocks).

-- Add services_json column to store the full array of service IDs as JSON
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'appointments'
      AND column_name = 'services_json'
  ) THEN
    ALTER TABLE appointments
      ADD COLUMN services_json TEXT DEFAULT NULL;
    RAISE NOTICE 'Column services_json added to appointments.';
  ELSE
    RAISE NOTICE 'Column services_json already exists -- skipped.';
  END IF;
END $$;

-- Add total_duration column (in minutes) for the entire cart visit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'appointments'
      AND column_name = 'total_duration'
  ) THEN
    ALTER TABLE appointments
      ADD COLUMN total_duration INTEGER DEFAULT 0;
    RAISE NOTICE 'Column total_duration added to appointments.';
  ELSE
    RAISE NOTICE 'Column total_duration already exists -- skipped.';
  END IF;
END $$;

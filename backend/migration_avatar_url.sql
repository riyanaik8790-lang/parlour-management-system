-- Migration: Add avatar_url column to users table
-- Run this once against your Supabase (Postgres) database SQL Editor.
-- Safe to re-run (idempotent).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
        RAISE NOTICE 'Added avatar_url column to users table.';
    ELSE
        RAISE NOTICE 'avatar_url column already exists on users table.';
    END IF;
END $$;

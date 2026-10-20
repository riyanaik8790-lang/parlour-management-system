-- Migration: Support multiple Web Push subscriptions per user in users table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run (idempotent).

DO $$
BEGIN
    -- Add push_subscriptions JSONB array column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'push_subscriptions'
    ) THEN
        ALTER TABLE users ADD COLUMN push_subscriptions JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added push_subscriptions column to users table.';
    END IF;

    -- Add push_subscription JSONB column if not exists (alias/compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'push_subscription'
    ) THEN
        ALTER TABLE users ADD COLUMN push_subscription JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added push_subscription column to users table.';
    END IF;
END $$;

-- Backfill from push_subscriptions table into users.push_subscriptions
UPDATE users u
SET push_subscriptions = sub_agg.subs,
    push_subscription = sub_agg.subs
FROM (
    SELECT user_id, json_agg(json_build_object(
        'endpoint', endpoint,
        'p256dh', p256dh,
        'auth', auth,
        'keys', json_build_object('p256dh', p256dh, 'auth', auth)
    )) as subs
    FROM push_subscriptions
    GROUP BY user_id
) sub_agg
WHERE u.id = sub_agg.user_id;

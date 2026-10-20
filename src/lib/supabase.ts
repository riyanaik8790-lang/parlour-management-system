// Supabase client — used ONLY for Storage operations (avatar uploads).
// Auth is still handled by the Flask/Postgres backend via JWT.
//
// Required env variables (add to .env.local and Vercel):
//   VITE_SUPABASE_URL      — your project URL, e.g. https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY — the public anon key from Project Settings → API
//
// These are SAFE to expose in the browser (Supabase anon key is public-facing).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. " +
    "Avatar uploads will be unavailable until these are configured in .env.local.",
  );
}

export const supabase = createClient(
  SUPABASE_URL ?? "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY ?? "placeholder",
);

/** Name of the public Supabase Storage bucket for user avatars */
export const AVATAR_BUCKET = "avatars";

/** Maximum allowed avatar file size: 2 MB */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

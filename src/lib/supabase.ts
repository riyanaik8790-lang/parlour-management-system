// Supabase client — used ONLY for Storage operations (avatar uploads).
// Auth is still handled by the Flask/Postgres backend via JWT.
//
// Required env variables (add to .env.local and Vercel):
//   VITE_SUPABASE_URL      — your project URL, e.g. https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY — the public anon key from Project Settings → API
//
// These are SAFE to expose in the browser (Supabase anon key is public-facing).

import { createClient } from "@supabase/supabase-js";

const env =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? (import.meta as any).env
    : typeof process !== "undefined" && process.env
      ? process.env
      : {};

const SUPABASE_URL =
  (env.VITE_SUPABASE_URL as string | undefined) ??
  "https://dldewlhruackgkwauxsx.supabase.co";
const SUPABASE_ANON_KEY =
  (env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZGV3bGhydWFja2drd2F1eHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4ODMxMDEsImV4cCI6MjEwNDQ1OTEwMX0.MA5jgO2E_SeeAFW8cLfjO7yApC7EXemBY5qRKH9Uh4I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Name of the public Supabase Storage bucket for user avatars */
export const AVATAR_BUCKET = "avatars";

/** Maximum allowed avatar file size: 2 MB */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

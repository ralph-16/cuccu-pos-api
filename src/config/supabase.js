// src/config/supabase.js
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in environment variables."
  );
}

/**
 * Anon/publishable client — no user session attached.
 * Used ONLY for auth operations that happen before we have a user token:
 * login (signInWithPassword) and refresh (refreshSession).
 */
function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Per-request client — scoped to a specific user's access token.
 * Every DB call made with this client runs AS that user in Postgres,
 * so your existing RLS policies (owner vs cashier) are the real
 * authorization boundary, not just Express middleware.
 *
 * IMPORTANT: never reuse this across requests/users — always create
 * a fresh one per incoming request.
 */
function getUserClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

module.exports = { getAnonClient, getUserClient };
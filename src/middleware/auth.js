// src/middleware/auth.js
const { createRemoteJWKSet, jwtVerify } = require("jose");
const { getUserClient } = require("../config/supabase");

const JWKS_URL = process.env.SUPABASE_JWKS_URL;

if (!JWKS_URL) {
  throw new Error("Missing SUPABASE_JWKS_URL in environment variables.");
}

// createRemoteJWKSet caches the public keys and handles rotation for us —
// we don't refetch on every request, only when a key ID we haven't seen appears.
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

/**
 * Verifies the incoming request's Bearer token and attaches:
 *   req.user     -> the decoded Supabase user (id, email, etc.)
 *   req.role     -> role read from the profiles table (owner | cashier)
 *   req.supabase -> a Supabase client scoped to this user's token,
 *                   so all downstream DB calls run under RLS as this user.
 *
 * Responds 401 if the token is missing, malformed, expired, or invalid.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        error:
          "Missing or malformed Authorization header. Expected: Bearer <token>",
      });
    }

    // Verifies signature, expiry, and issuer against Supabase's public keys.
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    });

    const userClient = getUserClient(token);

    // Look up the user's role from the profiles table (set by your
    // handle_new_user trigger). This call itself runs under RLS as
    // this user, who can always read their own profile row.
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", payload.sub)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        error: "No profile found for this user. Contact an administrator.",
      });
    }

    req.user = { id: payload.sub, email: payload.email };
    req.role = profile.role;
    req.profile = profile;
    req.supabase = userClient;

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

module.exports = { authenticate };

// src/controllers/auth.controller.js
const { getAnonClient } = require("../config/supabase");

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns Supabase's access_token + refresh_token on success.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Don't leak whether it was a bad email or bad password — just "invalid credentials"
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Body: { refresh_token }
 * Exchanges a valid refresh token for a new access token (and rotated
 * refresh token — Supabase rotates refresh tokens automatically).
 */
async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token is required." });
    }

    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token." });
    }

    res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Requires Authorization header. Invalidates the current session server-side.
 */
async function logout(req, res, next) {
  try {
    // req.supabase is already scoped to this user's token via authenticate middleware
    const { error } = await req.supabase.auth.signOut();

    if (error) throw error;

    res.status(200).json({ message: "Logged out successfully." });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Requires Authorization header. Returns the current user's profile.
 * Handy for the frontend to confirm role after login.
 */
async function me(req, res, next) {
  res.status(200).json({
    user: req.user,
    profile: req.profile,
  });
}

module.exports = { login, refresh, logout, me };

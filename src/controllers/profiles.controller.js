// src/controllers/profiles.controller.js

/**
 * GET /api/profiles
 * Owners see all profiles (RLS: "Owners can manage all profiles").
 * Cashiers hitting this will only ever get their own row back via RLS
 * (their SELECT policy is id = auth.uid()), so we don't need to
 * special-case the query itself — RLS filters it automatically.
 */
async function listProfiles(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * Owner-only per RLS. Used for e.g. promoting a cashier to owner,
 * or correcting a display name.
 */
async function updateProfile(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("profiles")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProfiles, getProfile, updateProfile };

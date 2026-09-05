// src/controllers/addons.controller.js

async function listAddons(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("addons")
      .select("id, name, price, is_available, created_at")
      .order("id", { ascending: true });

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getAddon(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("addons")
      .select("id, name, price, is_available, created_at")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createAddon(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("addons")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateAddon(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("addons")
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

async function deleteAddon(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("addons")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAddons,
  getAddon,
  createAddon,
  updateAddon,
  deleteAddon,
};

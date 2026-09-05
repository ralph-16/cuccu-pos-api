// src/controllers/categories.controller.js

async function listCategories(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("categories")
      .select("id, name, description")
      .order("id", { ascending: true });

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getCategory(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("categories")
      .select("id, name, description")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("categories")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("categories")
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

async function deleteCategory(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("categories")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
// src/controllers/ingredients.controller.js

async function listIngredients(req, res, next) {
  try {
    let query = req.supabase
      .from("ingredients")
      .select(
        "id, name, unit, stock_quantity, reorder_level, is_available, created_at",
      )
      .order("id", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // Optional low-stock filter, done in-memory since it's a cross-column
    // comparison (stock_quantity <= reorder_level) that PostgREST can't
    // express directly via query params.
    if (req.query.low_stock === "true") {
      const filtered = data.filter((i) => i.stock_quantity <= i.reorder_level);
      return res.status(200).json({ data: filtered });
    }

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getIngredient(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("ingredients")
      .select(
        "id, name, unit, stock_quantity, reorder_level, is_available, created_at",
      )
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createIngredient(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("ingredients")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateIngredient(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("ingredients")
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

async function deleteIngredient(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("ingredients")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listIngredients,
  getIngredient,
  createIngredient,
  updateIngredient,
  deleteIngredient,
};

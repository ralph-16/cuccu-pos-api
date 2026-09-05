// src/controllers/recipes.controller.js

async function listRecipes(req, res, next) {
  try {
    let query = req.supabase
      .from("recipes")
      .select("id, product_variant_id, ingredient_id, quantity, created_at")
      .order("id", { ascending: true });

    if (req.query.product_variant_id) {
      query = query.eq("product_variant_id", req.query.product_variant_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getRecipe(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("recipes")
      .select("id, product_variant_id, ingredient_id, quantity, created_at")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createRecipe(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("recipes")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateRecipe(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("recipes")
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

async function deleteRecipe(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("recipes")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
};

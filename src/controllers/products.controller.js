// src/controllers/products.controller.js

/**
 * GET /api/products
 * Any authenticated user (owner or cashier) can view products.
 * Supports optional ?category_id= filter.
 */
async function listProducts(req, res, next) {
  try {
    let query = req.supabase
      .from("products")
      .select("id, category_id, name, description, is_available, created_at")
      .order("id", { ascending: true });

    if (req.query.category_id) {
      query = query.eq("category_id", req.query.category_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:id
 */
async function getProduct(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("products")
      .select("id, category_id, name, description, is_available, created_at")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/products
 * Owner-only (enforced by requireRole middleware AND RLS policy).
 */
async function createProduct(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("products")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/products/:id
 * Owner-only.
 */
async function updateProduct(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("products")
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

/**
 * DELETE /api/products/:id
 * Owner-only.
 */
async function deleteProduct(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("products")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};

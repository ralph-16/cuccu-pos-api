// src/controllers/productVariants.controller.js

async function listProductVariants(req, res, next) {
  try {
    let query = req.supabase
      .from("product_variants")
      .select(
        "id, product_id, variant_name, size, temperature, price, is_available",
      )
      .order("id", { ascending: true });

    if (req.query.product_id) {
      query = query.eq("product_id", req.query.product_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getProductVariant(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("product_variants")
      .select(
        "id, product_id, variant_name, size, temperature, price, is_available",
      )
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createProductVariant(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("product_variants")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateProductVariant(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("product_variants")
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

async function deleteProductVariant(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("product_variants")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProductVariants,
  getProductVariant,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
};

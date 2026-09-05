// src/controllers/orderItems.controller.js

async function listOrderItems(req, res, next) {
  try {
    let query = req.supabase
      .from("order_items")
      .select(
        "id, order_id, product_variant_id, quantity, unit_price, subtotal",
      )
      .order("id", { ascending: true });

    if (req.query.order_id) {
      query = query.eq("order_id", req.query.order_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOrderItem(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("order_items")
      .select(
        "id, order_id, product_variant_id, quantity, unit_price, subtotal",
      )
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createOrderItem(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("order_items")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateOrderItem(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("order_items")
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

async function deleteOrderItem(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("order_items")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOrderItems,
  getOrderItem,
  createOrderItem,
  updateOrderItem,
  deleteOrderItem,
};

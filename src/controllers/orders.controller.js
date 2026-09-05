// src/controllers/orders.controller.js

async function listOrders(req, res, next) {
  try {
    let query = req.supabase
      .from("orders")
      .select(
        "id, profile_id, order_status, payment_method, subtotal, discount_amount, total_amount, created_at",
      )
      .order("created_at", { ascending: false });

    if (req.query.status) {
      query = query.eq("order_status", req.query.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("orders")
      .select(
        "id, profile_id, order_status, payment_method, subtotal, discount_amount, total_amount, created_at",
      )
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * profile_id is always set from the authenticated user's own id —
 * never taken from the request body. This prevents a cashier from
 * creating an order attributed to someone else.
 */
async function createOrder(req, res, next) {
  try {
    const payload = { ...req.body, profile_id: req.user.id };

    const { data, error } = await req.supabase
      .from("orders")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateOrder(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("orders")
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
 * Owner-only per RLS (cashiers have no DELETE policy on orders at all).
 */
async function deleteOrder(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("orders")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
};

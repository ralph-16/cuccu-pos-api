// src/controllers/orderItemAddons.controller.js

async function listOrderItemAddons(req, res, next) {
  try {
    let query = req.supabase
      .from("order_item_addons")
      .select("id, order_item_id, addon_id, quantity, unit_price")
      .order("id", { ascending: true });

    if (req.query.order_item_id) {
      query = query.eq("order_item_id", req.query.order_item_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOrderItemAddon(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("order_item_addons")
      .select("id, order_item_id, addon_id, quantity, unit_price")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createOrderItemAddon(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("order_item_addons")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateOrderItemAddon(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("order_item_addons")
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

async function deleteOrderItemAddon(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("order_item_addons")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOrderItemAddons,
  getOrderItemAddon,
  createOrderItemAddon,
  updateOrderItemAddon,
  deleteOrderItemAddon,
};

// src/controllers/inventoryTransactions.controller.js

async function listInventoryTransactions(req, res, next) {
  try {
    let query = req.supabase
      .from("inventory_transactions")
      .select(
        "id, ingredient_id, transaction_type, quantity, reference_type, reference_id, notes, created_at",
      )
      .order("created_at", { ascending: false });

    if (req.query.ingredient_id) {
      query = query.eq("ingredient_id", req.query.ingredient_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getInventoryTransaction(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("inventory_transactions")
      .select(
        "id, ingredient_id, transaction_type, quantity, reference_type, reference_id, notes, created_at",
      )
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function createInventoryTransaction(req, res, next) {
  try {
    // Note: this inserts the LEDGER entry only. Your existing
    // update_ingredient_stock trigger (on inventory_transactions insert)
    // handles actually adjusting ingredients.stock_quantity — the API
    // does not duplicate that math here.
    const { data, error } = await req.supabase
      .from("inventory_transactions")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function deleteInventoryTransaction(req, res, next) {
  try {
    const { error } = await req.supabase
      .from("inventory_transactions")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listInventoryTransactions,
  getInventoryTransaction,
  createInventoryTransaction,
  deleteInventoryTransaction,
};

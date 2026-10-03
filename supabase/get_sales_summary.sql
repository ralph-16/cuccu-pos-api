-- ============================================================
-- CUCCU-POS: Sales summary report function
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query
--
-- Used by: GET /api/reports/sales-summary (owner-only endpoint)
-- Called by the API via supabase.rpc('get_sales_summary', ...) with the
-- per-user RLS client — no secret key involved.
--
-- Safe to re-run: CREATE OR REPLACE, touches no data.
--
-- Day boundaries use 'Asia/Manila' (the cafe's business timezone, UTC+8),
-- NOT the server's timezone — Render runs the API on UTC, which would
-- misfile morning sales into the previous day. Change the literal if the
-- business timezone ever changes.
--
-- SECURITY DEFINER is required so the aggregate sees all orders (owners
-- already can under RLS). Postgres grants EXECUTE to PUBLIC by default,
-- so a cashier JWT could otherwise call this function directly against
-- Supabase's REST endpoint, bypassing the API's Express-level owner
-- check — the in-function guard below closes that hole: the caller's
-- JWT must resolve to a profiles row with role = 'owner'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_sales_summary(
    p_from_date date DEFAULT NULL,
    p_to_date date DEFAULT NULL
)
RETURNS TABLE (
    from_date date,
    to_date date,
    total_revenue numeric,
    order_count bigint,
    revenue_by_payment_method jsonb,
    average_order_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_from date;
    v_to date;
    v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
    v_from := COALESCE(p_from_date, v_today);
    v_to := COALESCE(p_to_date, v_today);

    -- Owner-only at the DATABASE layer, not just in Express middleware.
    -- SECURITY DEFINER runs as the function owner, so this profiles lookup
    -- sees all rows; the caller's auth.uid() decides whose profile it is.
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Only owners may call get_sales_summary';
    END IF;

    IF v_to < v_from THEN
        RAISE EXCEPTION 'p_to_date must be on or after p_from_date';
    END IF;

    -- No GROUP BY: an aggregate without one always returns exactly ONE row,
    -- even when the window matches zero orders (sums NULL -> COALESCE 0).
    -- A GROUP BY version would return zero rows for an empty window and the
    -- API would hand the frontend an array instead of zeroed stats.
    RETURN QUERY
    WITH completed AS (
        SELECT o.payment_method, o.total_amount
        FROM public.orders o
        WHERE o.order_status = 'completed'
          AND (o.created_at AT TIME ZONE 'Asia/Manila')::date >= v_from
          AND (o.created_at AT TIME ZONE 'Asia/Manila')::date <= v_to
    ),
    totals AS (
        SELECT
            COALESCE(sum(total_amount), 0)::numeric AS total_revenue,
            count(*)::bigint AS order_count,
            COALESCE(sum(total_amount) FILTER (WHERE payment_method = 'cash'), 0)::numeric AS cash_revenue,
            COALESCE(sum(total_amount) FILTER (WHERE payment_method = 'gcash'), 0)::numeric AS gcash_revenue,
            COALESCE(sum(total_amount) FILTER (WHERE payment_method = 'maya'), 0)::numeric AS maya_revenue,
            COALESCE(sum(total_amount) / NULLIF(count(*), 0), 0)::numeric AS average_order_value
        FROM completed
    )
    SELECT
        v_from,
        v_to,
        t.total_revenue,
        t.order_count,
        jsonb_build_object(
            'cash', t.cash_revenue,
            'gcash', t.gcash_revenue,
            'maya', t.maya_revenue
        ),
        t.average_order_value
    FROM totals t;
END;
$func$;

-- No explicit GRANT needed: the API calls this through the per-user RLS
-- client, and the in-function guard (not a grant) is what makes it
-- owner-only. Keeping default EXECUTE behavior matches the existing
-- find_payment_by_provider_id / update_payment_status pattern.

-- Quick self-checks you can run after creating it (owner session only):
--   SELECT * FROM public.get_sales_summary();                        -- today
--   SELECT * FROM public.get_sales_summary('2026-09-01','2026-09-20');
--   SELECT * FROM public.get_sales_summary('2099-01-01','2099-12-31'); -- zeros

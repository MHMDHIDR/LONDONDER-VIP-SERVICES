-- Overview aggregates for the dashboard (KPI strip + charts).
-- SECURITY INVOKER: row-level security scopes managers to their own rows and
-- admins to everything, identical to the invoice grid.
--
-- Returns:
--   {
--     from, to,
--     days:         [{ day, invoiced_pence, invoice_count, paid_out_pence, payout_count }]  (zero-filled)
--     service_days: [{ day, service, invoiced_pence, invoice_count }]                       (non-zero rows only;
--                                                                                            service is null for
--                                                                                            custom line items)
--   }
CREATE OR REPLACE FUNCTION public.dashboard_stats(_from DATE, _to DATE)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH days AS (
    SELECT generate_series(_from, _to, interval '1 day')::date AS day
  ),
  r AS (
    SELECT issue_date AS day, sum(total_pence) AS invoiced_pence, count(*) AS invoice_count
    FROM public.receipts
    WHERE status = 'issued' AND deleted_at IS NULL AND issue_date BETWEEN _from AND _to
    GROUP BY issue_date
  ),
  p AS (
    SELECT issue_date AS day, sum(total_pence) AS paid_out_pence, count(*) AS payout_count
    FROM public.payouts
    WHERE status = 'issued' AND deleted_at IS NULL AND issue_date BETWEEN _from AND _to
    GROUP BY issue_date
  ),
  svc_days AS (
    SELECT issue_date AS day,
           NULLIF(btrim(service_name_snapshot), '') AS service,
           sum(total_pence) AS invoiced_pence,
           count(*) AS invoice_count
    FROM public.receipts
    WHERE status = 'issued' AND deleted_at IS NULL AND issue_date BETWEEN _from AND _to
    GROUP BY 1, 2
  )
  SELECT jsonb_build_object(
    'from', _from,
    'to', _to,
    'days', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'day', d.day,
               'invoiced_pence', COALESCE(r.invoiced_pence, 0),
               'invoice_count',  COALESCE(r.invoice_count, 0),
               'paid_out_pence', COALESCE(p.paid_out_pence, 0),
               'payout_count',   COALESCE(p.payout_count, 0)
             ) ORDER BY d.day)
      FROM days d
      LEFT JOIN r ON r.day = d.day
      LEFT JOIN p ON p.day = d.day
    ), '[]'::jsonb),
    'service_days', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'day', day,
               'service', service,
               'invoiced_pence', invoiced_pence,
               'invoice_count', invoice_count
             ) ORDER BY day, service NULLS LAST)
      FROM svc_days
    ), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_stats(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(DATE, DATE) TO authenticated, service_role;

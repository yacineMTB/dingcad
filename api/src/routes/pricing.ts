import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireAdmin } from "../auth";

const router = Router();

router.get("/compare/:materialId", async (req, res) => {
  const result = await query(
    `SELECT p.*, s.name AS supplier_name, s.url AS supplier_url
     FROM pricing p
     JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.material_id = $1
     ORDER BY p.unit_price ASC`,
    [req.params.materialId]
  );
  res.json(result.rows);
});

router.put(
  "/:materialId/:supplierId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { unit_price, unit, sku, ean, link, is_primary } = req.body;
    const { materialId, supplierId } = req.params;

    if (is_primary) {
      await query(
        "UPDATE pricing SET is_primary=false WHERE material_id=$1",
        [materialId]
      );
    }

    const result = await query(
      `INSERT INTO pricing (material_id, supplier_id, unit, unit_price, sku, ean, link, is_primary, last_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (material_id, supplier_id) DO UPDATE SET
         unit=$3, unit_price=$4, sku=$5, ean=$6, link=$7,
         is_primary=COALESCE($8, pricing.is_primary),
         last_verified_at=now(), updated_at=now()
       RETURNING *`,
      [materialId, supplierId, unit, unit_price, sku, ean, link, is_primary ?? false]
    );

    await query(
      `INSERT INTO pricing_history (pricing_id, unit_price, source)
       VALUES ($1, $2, 'manual')`,
      [result.rows[0].id, unit_price]
    );

    res.json(result.rows[0]);
  }
);

router.get("/history/:materialId", async (req, res) => {
  const result = await query(
    `SELECT ph.*, p.supplier_id, s.name AS supplier_name
     FROM pricing_history ph
     JOIN pricing p ON ph.pricing_id = p.id
     JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.material_id = $1
     ORDER BY ph.scraped_at DESC
     LIMIT 200`,
    [req.params.materialId]
  );
  res.json(result.rows);
});

router.get("/stale", requireAuth, requireAdmin, async (_req, res) => {
  const result = await query(
    `SELECT m.id, m.name, p.supplier_id, s.name AS supplier_name,
      p.unit_price, p.last_scraped_at,
      EXTRACT(EPOCH FROM (now() - p.last_scraped_at))/86400 AS days_stale
     FROM pricing p
     JOIN materials m ON p.material_id = m.id
     JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.is_primary = true
       AND (p.last_scraped_at IS NULL OR p.last_scraped_at < now() - interval '30 days')
     ORDER BY p.last_scraped_at ASC NULLS FIRST`
  );
  res.json(result.rows);
});

export default router;

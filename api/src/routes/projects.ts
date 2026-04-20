import { Router } from "express";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import { query } from "../db";
import { requireAuth } from "../auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const result = await query(
    `SELECT id, name, description, is_public, created_at, updated_at, thumbnail_url,
      (SELECT COALESCE(SUM(pb.quantity * p.unit_price * m.waste_factor), 0)
       FROM project_bom pb
       JOIN pricing p ON pb.material_id = p.material_id AND p.is_primary = true
       JOIN materials m ON pb.material_id = m.id
       WHERE pb.project_id = projects.id) AS estimated_cost
     FROM projects WHERE user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC`,
    [req.user!.id]
  );
  res.json(result.rows);
});

router.get("/trash", async (req, res) => {
  const result = await query(
    `SELECT id, name, description, is_public, created_at, updated_at, deleted_at, thumbnail_url,
      (SELECT COALESCE(SUM(pb.quantity * p.unit_price * m.waste_factor), 0)
       FROM project_bom pb
       JOIN pricing p ON pb.material_id = p.material_id AND p.is_primary = true
       JOIN materials m ON pb.material_id = m.id
       WHERE pb.project_id = projects.id) AS estimated_cost
     FROM projects WHERE user_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
    [req.user!.id]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { name, description, scene_js, building_info } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Project name is required" });
  }
  if (name.length > 200) {
    return res.status(400).json({ error: "Project name must be 200 characters or fewer" });
  }
  const result = await query(
    `INSERT INTO projects (user_id, name, description, scene_js, building_info)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user!.id, name.trim(), description, scene_js, building_info ? JSON.stringify(building_info) : null]
  );
  res.status(201).json(result.rows[0]);
});

router.get("/:id", async (req, res) => {
  const result = await query(
    "SELECT * FROM projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
    [req.params.id, req.user!.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: "Project not found" });

  const bom = await query(
    `SELECT pb.*, m.name AS material_name, c.display_name AS category_name,
      p.unit_price, p.link, s.name AS supplier_name,
      (pb.quantity * p.unit_price * m.waste_factor) AS total
     FROM project_bom pb
     JOIN materials m ON pb.material_id = m.id
     JOIN categories c ON m.category_id = c.id
     LEFT JOIN pricing p ON m.id = p.material_id AND p.is_primary = true
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE pb.project_id = $1
     ORDER BY c.sort_order`,
    [req.params.id]
  );

  res.json({ ...result.rows[0], bom: bom.rows });
});

router.put("/:id", async (req, res) => {
  const { name, description, scene_js } = req.body;
  if (name !== undefined && (typeof name !== "string" || name.length > 200)) {
    return res.status(400).json({ error: "Project name must be 200 characters or fewer" });
  }
  const result = await query(
    `UPDATE projects SET name=COALESCE($1, name), description=COALESCE($2, description), scene_js=COALESCE($3, scene_js), updated_at=now()
     WHERE id=$4 AND user_id=$5 RETURNING *`,
    [name?.trim(), description, scene_js, req.params.id, req.user!.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: "Project not found" });
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  await query(
    "UPDATE projects SET deleted_at = NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
    [req.params.id, req.user!.id]
  );
  res.json({ ok: true });
});

router.post("/:id/restore", async (req, res) => {
  const result = await query(
    "UPDATE projects SET deleted_at = NULL, updated_at = NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NOT NULL RETURNING id",
    [req.params.id, req.user!.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: "Project not found in trash" });
  res.json({ ok: true });
});

router.delete("/:id/permanent", async (req, res) => {
  await query(
    "DELETE FROM projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NOT NULL",
    [req.params.id, req.user!.id]
  );
  res.json({ ok: true });
});

// --------------------------------------------------------------------------
// Share / Unshare endpoints
// --------------------------------------------------------------------------
router.post("/:id/share", async (req, res) => {
  // Check ownership
  const proj = await query(
    "SELECT id, share_token FROM projects WHERE id=$1 AND user_id=$2",
    [req.params.id, req.user!.id]
  );
  if (proj.rows.length === 0) {
    return res.status(404).json({ error: "Project not found" });
  }

  // If already shared, return existing token
  if (proj.rows[0].share_token) {
    return res.json({ share_token: proj.rows[0].share_token });
  }

  // Generate a new share token (UUID v4)
  const shareToken = crypto.randomUUID();
  await query(
    "UPDATE projects SET share_token = $1, updated_at = now() WHERE id = $2",
    [shareToken, req.params.id]
  );

  res.json({ share_token: shareToken });
});

router.delete("/:id/share", async (req, res) => {
  const result = await query(
    "UPDATE projects SET share_token = NULL, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.user!.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json({ ok: true });
});

router.put("/:id/bom", async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items))
    return res.status(400).json({ error: "items must be an array" });

  const proj = await query(
    "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
    [req.params.id, req.user!.id]
  );
  if (proj.rows.length === 0)
    return res.status(404).json({ error: "Project not found" });

  // Validate all items before modifying anything
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const idx = i + 1;

    if (
      item.material_id == null ||
      typeof item.material_id !== "string" ||
      item.material_id.trim().length === 0
    ) {
      return res.status(400).json({
        error: `Item ${idx}: material_id must be a non-empty string`,
      });
    }

    const qty = Number(item.quantity);
    if (item.quantity == null || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        error: `Item ${idx}: quantity must be a positive finite number`,
      });
    }

    // Cap quantity at a sensible upper bound to prevent abuse
    if (qty > 1_000_000) {
      return res.status(400).json({
        error: `Item ${idx}: quantity must not exceed 1,000,000`,
      });
    }
  }

  try {
    await query("DELETE FROM project_bom WHERE project_id=$1", [req.params.id]);
    let inserted = 0;
    for (const item of items) {
      const matExists = await query("SELECT id FROM materials WHERE id=$1", [item.material_id]);
      if (matExists.rows.length === 0) continue;
      await query(
        `INSERT INTO project_bom (project_id, material_id, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, item.material_id, item.quantity, item.unit || "kpl"]
      );
      inserted++;
    }
    res.json({ ok: true, count: inserted, skipped: items.length - inserted });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save BOM", detail: err.message });
  }
});

router.put("/:id/thumbnail", async (req, res) => {
  const { thumbnail } = req.body;
  if (!thumbnail || typeof thumbnail !== "string") {
    return res.status(400).json({ error: "thumbnail (base64 data URL) is required" });
  }
  // Limit thumbnail size to 200KB of base64 data
  if (thumbnail.length > 200 * 1024) {
    return res.status(400).json({ error: "Thumbnail too large (max 200KB)" });
  }
  const result = await query(
    "UPDATE projects SET thumbnail_url = $1, updated_at = now() WHERE id = $2 AND user_id = $3 RETURNING id",
    [thumbnail, req.params.id, req.user!.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json({ ok: true });
});

router.post("/:id/duplicate", async (req, res) => {
  const src = await query(
    "SELECT * FROM projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
    [req.params.id, req.user!.id]
  );
  if (src.rows.length === 0)
    return res.status(404).json({ error: "Project not found" });
  const p = src.rows[0];

  // Use locale header to determine copy suffix
  const acceptLang = req.headers["accept-language"] || "";
  const suffix = acceptLang.toLowerCase().startsWith("fi") ? "(kopio)" : "(copy)";

  const dup = await query(
    `INSERT INTO projects (user_id, name, description, scene_js)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user!.id, `${p.name} ${suffix}`, p.description, p.scene_js]
  );
  const newId = dup.rows[0].id;

  // Copy BOM items to the new project
  const bomItems = await query(
    "SELECT material_id, quantity, unit FROM project_bom WHERE project_id = $1",
    [req.params.id]
  );
  for (const item of bomItems.rows) {
    await query(
      "INSERT INTO project_bom (project_id, material_id, quantity, unit) VALUES ($1, $2, $3, $4)",
      [newId, item.material_id, item.quantity, item.unit]
    );
  }

  res.status(201).json(dup.rows[0]);
});

// ---------------------------------------------------------------------------
// PDF cost-estimate export
// ---------------------------------------------------------------------------

const pdfStrings = {
  fi: {
    header: "Helscoop \u2014 Kustannusarvio",
    projectName: "Projekti",
    description: "Kuvaus",
    date: "P\u00e4iv\u00e4m\u00e4\u00e4r\u00e4",
    bomTitle: "Materiaalilista",
    colMaterial: "Materiaali",
    colQty: "M\u00e4\u00e4r\u00e4",
    colUnit: "Yksikk\u00f6",
    colUnitPrice: "Yks.hinta",
    colTotal: "Yhteens\u00e4",
    colSupplier: "Toimittaja",
    total: "YHTEENS\u00c4",
    inclVat: "sis. ALV 25,5 %",
    footer: "Luotu Helscoop.fi -palvelulla",
    noDescription: "Ei kuvausta",
    page: "Sivu",
  },
  en: {
    header: "Helscoop \u2014 Cost Estimate",
    projectName: "Project",
    description: "Description",
    date: "Date",
    bomTitle: "Bill of Materials",
    colMaterial: "Material",
    colQty: "Qty",
    colUnit: "Unit",
    colUnitPrice: "Unit price",
    colTotal: "Total",
    colSupplier: "Supplier",
    total: "TOTAL",
    inclVat: "incl. VAT 25.5%",
    footer: "Generated with Helscoop.fi",
    noDescription: "No description",
    page: "Page",
  },
};

router.get("/:id/pdf", async (req, res) => {
  const lang = (req.query.lang === "en" ? "en" : "fi") as keyof typeof pdfStrings;
  const s = pdfStrings[lang];

  // Fetch project
  const projResult = await query(
    "SELECT * FROM projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
    [req.params.id, req.user!.id]
  );
  if (projResult.rows.length === 0) {
    return res.status(404).json({ error: "Project not found" });
  }
  const project = projResult.rows[0];

  // Fetch BOM with pricing
  const bomResult = await query(
    `SELECT pb.*, m.name AS material_name, m.waste_factor,
      p.unit_price, p.unit,
      (pb.quantity * p.unit_price * m.waste_factor) AS line_cost,
      s.name AS supplier_name
     FROM project_bom pb
     JOIN materials m ON pb.material_id = m.id
     LEFT JOIN pricing p ON m.id = p.material_id AND p.is_primary = true
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE pb.project_id = $1
     ORDER BY m.name`,
    [req.params.id]
  );

  const bomRows = bomResult.rows;
  const grandTotal = bomRows.reduce(
    (sum: number, r: { line_cost: string | null }) => sum + Number(r.line_cost || 0),
    0
  );

  // Build PDF
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });

  // Stream to response
  res.setHeader("Content-Type", "application/pdf");
  const safeName = (project.name || "project").replace(/[^a-zA-Z0-9_\-]/g, "_");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="helscoop_${safeName}.pdf"`
  );
  doc.pipe(res);

  // --- Header ---
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(s.header, { align: "center" });
  doc.moveDown(0.3);
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor("#c4915c")
    .lineWidth(2)
    .stroke();
  doc.moveDown(1);

  // --- Project info ---
  const infoLabelX = 50;
  const infoValueX = 170;

  doc.fontSize(11).font("Helvetica-Bold").text(`${s.projectName}:`, infoLabelX, doc.y);
  doc.font("Helvetica").text(project.name || "", infoValueX, doc.y - doc.currentLineHeight());
  doc.moveDown(0.3);

  doc.font("Helvetica-Bold").text(`${s.description}:`, infoLabelX, doc.y);
  doc.font("Helvetica").text(project.description || s.noDescription, infoValueX, doc.y - doc.currentLineHeight());
  doc.moveDown(0.3);

  const dateStr = new Date().toLocaleDateString(lang === "fi" ? "fi-FI" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.font("Helvetica-Bold").text(`${s.date}:`, infoLabelX, doc.y);
  doc.font("Helvetica").text(dateStr, infoValueX, doc.y - doc.currentLineHeight());
  doc.moveDown(1.5);

  // --- BOM table ---
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(s.bomTitle)
    .moveDown(0.5);

  // Table layout
  const tableLeft = 50;
  const colWidths = [180, 45, 40, 70, 70, 90];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const headers = [s.colMaterial, s.colQty, s.colUnit, s.colUnitPrice, s.colTotal, s.colSupplier];
  const rowHeight = 22;

  function drawTableHeader(yPos: number) {
    doc
      .rect(tableLeft, yPos, tableWidth, rowHeight)
      .fill("#3d3831");

    let x = tableLeft;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#e0dcd4");
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 4, yPos + 6, { width: colWidths[i] - 8, align: i >= 1 && i <= 4 ? "right" : "left" });
      x += colWidths[i];
    }
    doc.fillColor("#1a1816");
    return yPos + rowHeight;
  }

  let y = drawTableHeader(doc.y);

  // Data rows
  for (let rowIdx = 0; rowIdx < bomRows.length; rowIdx++) {
    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = drawTableHeader(50);
    }

    const row = bomRows[rowIdx];
    const isAlt = rowIdx % 2 === 1;

    if (isAlt) {
      doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#f5f2ed");
    }

    const unitPrice = Number(row.unit_price || 0);
    const lineCost = Number(row.line_cost || 0);

    let x = tableLeft;
    doc.fontSize(9).font("Helvetica").fillColor("#1a1816");

    doc.text(row.material_name || "", x + 4, y + 6, { width: colWidths[0] - 8, align: "left" });
    x += colWidths[0];

    doc.text(String(row.quantity), x + 4, y + 6, { width: colWidths[1] - 8, align: "right" });
    x += colWidths[1];

    doc.text(row.unit || "kpl", x + 4, y + 6, { width: colWidths[2] - 8, align: "right" });
    x += colWidths[2];

    doc.text(unitPrice.toFixed(2), x + 4, y + 6, { width: colWidths[3] - 8, align: "right" });
    x += colWidths[3];

    doc.font("Helvetica-Bold").text(lineCost.toFixed(2), x + 4, y + 6, { width: colWidths[4] - 8, align: "right" });
    x += colWidths[4];

    doc.font("Helvetica").text(row.supplier_name || "", x + 4, y + 6, { width: colWidths[5] - 8, align: "left" });

    doc
      .moveTo(tableLeft, y + rowHeight)
      .lineTo(tableLeft + tableWidth, y + rowHeight)
      .strokeColor("#d4d0c8")
      .lineWidth(0.5)
      .stroke();

    y += rowHeight;
  }

  // Grand total row
  if (y + rowHeight + 8 > doc.page.height - 80) {
    doc.addPage();
    y = 50;
  }
  y += 4;
  doc
    .rect(tableLeft, y, tableWidth, rowHeight + 4)
    .fill("#c4915c");

  const totalColX = tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#ffffff");
  doc.text(s.total, tableLeft + 4, y + 7);
  doc.text(
    grandTotal.toLocaleString(lang === "fi" ? "fi-FI" : "en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " EUR",
    totalColX + 4,
    y + 7,
    { width: colWidths[4] - 8, align: "right" }
  );

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#1a1816")
    .text(s.inclVat, tableLeft, y + rowHeight + 10);

  // --- Supplier attributions ---
  const suppliers = [...new Set(
    bomRows
      .map((r: { supplier_name?: string }) => r.supplier_name)
      .filter((name): name is string => Boolean(name))
  )];
  if (suppliers.length > 0) {
    const suppY = Math.max(doc.y, y + rowHeight + 28);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#8a857d")
      .text(
        (lang === "fi" ? "Hintatiedot: " : "Pricing from: ") + suppliers.join(", "),
        tableLeft,
        suppY
      );
  }

  // --- Footer on each page ---
  const range = doc.bufferedPageRange();
  const pageCount = range.count;
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#8a857d");
    doc.text(
      `${s.footer} \u2014 ${timestamp}`,
      50,
      doc.page.height - 40,
      { width: doc.page.width - 100, align: "left" }
    );
    doc.text(
      `${s.page} ${i + 1} / ${pageCount}`,
      50,
      doc.page.height - 40,
      { width: doc.page.width - 100, align: "right" }
    );
  }

  doc.end();
});

export default router;

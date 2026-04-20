import { Pool } from "pg";
import * as cheerio from "cheerio";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://dingcad:dingcad_dev@localhost:5432/dingcad",
});

interface PricingRow {
  id: string;
  material_id: string;
  supplier_id: string;
  unit: string;
  unit_price: number;
  link: string | null;
}

interface ScrapeResult {
  materialId: string;
  oldPrice: number;
  newPrice: number | null;
  error?: string;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Helscoop PriceBot/1.0; +https://github.com/dzautner/helscoop)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function extractPrice(html: string, config: Record<string, string>): number | null {
  const $ = cheerio.load(html);

  const selectors = [
    config.priceSelector,
    '[data-price]',
    '.product-price',
    '.price__current',
    '.product__price',
    '.price-tag',
    'meta[property="product:price:amount"]',
  ].filter(Boolean) as string[];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;

    let text = el.attr("content") || el.attr("data-price") || el.text();
    if (!text) continue;

    text = text.replace(/[^\d.,]/g, "").replace(",", ".");
    const price = parseFloat(text);
    if (!isNaN(price) && price > 0 && price < 100000) return price;
  }
  return null;
}

async function scrapeSupplier(supplierId: string): Promise<ScrapeResult[]> {
  const supplierResult = await pool.query(
    "SELECT * FROM suppliers WHERE id = $1 AND scrape_enabled = true",
    [supplierId]
  );
  if (supplierResult.rows.length === 0) {
    console.log(`Supplier ${supplierId} not found or scraping disabled`);
    return [];
  }

  const supplier = supplierResult.rows[0];
  const config = (supplier.scrape_config as Record<string, string>) || {};

  if (config.type === "manual") {
    console.log(`Supplier ${supplierId} is manual-only, skipping`);
    return [];
  }

  const pricingResult = await pool.query(
    "SELECT * FROM pricing WHERE supplier_id = $1 AND link IS NOT NULL",
    [supplierId]
  );

  const results: ScrapeResult[] = [];

  for (const row of pricingResult.rows as PricingRow[]) {
    if (!row.link) continue;

    console.log(`  Scraping ${row.material_id} from ${row.link}`);
    const html = await fetchPage(row.link);

    if (!html) {
      results.push({
        materialId: row.material_id,
        oldPrice: row.unit_price,
        newPrice: null,
        error: "Failed to fetch page",
      });
      continue;
    }

    const newPrice = extractPrice(html, config);
    results.push({
      materialId: row.material_id,
      oldPrice: row.unit_price,
      newPrice,
      error: newPrice === null ? "Price not found on page" : undefined,
    });

    if (newPrice !== null && newPrice !== row.unit_price) {
      await pool.query(
        "UPDATE pricing SET unit_price=$1, last_scraped_at=now(), updated_at=now() WHERE id=$2",
        [newPrice, row.id]
      );
      await pool.query(
        "INSERT INTO pricing_history (pricing_id, unit_price, source) VALUES ($1, $2, 'scraper')",
        [row.id, newPrice]
      );
      console.log(
        `    Price updated: ${row.unit_price} → ${newPrice} EUR`
      );
    } else if (newPrice !== null) {
      await pool.query(
        "UPDATE pricing SET last_scraped_at=now() WHERE id=$1",
        [row.id]
      );
      console.log(`    Price unchanged: ${newPrice} EUR`);
    }

    // Rate limit: 2s between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const supplierFilter = args.includes("--supplier")
    ? args[args.indexOf("--supplier") + 1]
    : null;

  console.log("=== Helscoop Price Scraper ===\n");

  const suppliersResult = supplierFilter
    ? await pool.query(
        "SELECT id FROM suppliers WHERE id = $1 AND scrape_enabled = true",
        [supplierFilter]
      )
    : await pool.query(
        "SELECT id FROM suppliers WHERE scrape_enabled = true ORDER BY id"
      );

  let totalChecked = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const { id: supplierId } of suppliersResult.rows) {
    console.log(`\nScraping supplier: ${supplierId}`);

    const runResult = await pool.query(
      "INSERT INTO scrape_runs (supplier_id) VALUES ($1) RETURNING id",
      [supplierId]
    );
    const runId = runResult.rows[0].id;

    const results = await scrapeSupplier(supplierId);
    const checked = results.length;
    const updated = results.filter(
      (r) => r.newPrice !== null && r.newPrice !== r.oldPrice
    ).length;
    const errors = results.filter((r) => r.error).length;

    totalChecked += checked;
    totalUpdated += updated;
    totalErrors += errors;

    const errorLog = results
      .filter((r) => r.error)
      .map((r) => `${r.materialId}: ${r.error}`)
      .join("\n");

    await pool.query(
      `UPDATE scrape_runs SET finished_at=now(), status='completed',
        materials_checked=$1, prices_updated=$2, errors=$3, error_log=$4
       WHERE id=$5`,
      [checked, updated, errors, errorLog || null, runId]
    );
  }

  console.log("\n=== Summary ===");
  console.log(`  Checked: ${totalChecked}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Errors:  ${totalErrors}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});

import { describe, it, expect } from "vitest";

describe("API structure", () => {
  it("has all route files", async () => {
    const materials = await import("../routes/materials");
    const projects = await import("../routes/projects");
    const suppliers = await import("../routes/suppliers");
    const pricing = await import("../routes/pricing");
    const chat = await import("../routes/chat");
    expect(materials.default).toBeDefined();
    expect(projects.default).toBeDefined();
    expect(suppliers.default).toBeDefined();
    expect(pricing.default).toBeDefined();
    expect(chat.default).toBeDefined();
  });

  it("auth module exports required functions", async () => {
    const auth = await import("../auth");
    expect(auth.signToken).toBeTypeOf("function");
    expect(auth.requireAuth).toBeTypeOf("function");
    expect(auth.requireAdmin).toBeTypeOf("function");
    expect(auth.login).toBeTypeOf("function");
    expect(auth.register).toBeTypeOf("function");
    expect(auth.verifyEmail).toBeTypeOf("function");
    expect(auth.resendVerification).toBeTypeOf("function");
  });

  it("email module exports required functions", async () => {
    const email = await import("../email");
    expect(email.sendEmail).toBeTypeOf("function");
    expect(email.sendPasswordResetEmail).toBeTypeOf("function");
    expect(email.sendVerificationEmail).toBeTypeOf("function");
    expect(email.sendPriceAlertEmail).toBeTypeOf("function");
  });

  it("db module exports pool and query", async () => {
    const db = await import("../db");
    expect(db.pool).toBeDefined();
    expect(db.query).toBeTypeOf("function");
  });

  it("signToken creates a valid JWT", async () => {
    const { signToken } = await import("../auth");
    const token = signToken({ id: "test-id", email: "test@test.com", role: "user" });
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("SQL migrations", () => {
  it("001_initial_schema.sql has all required tables and views", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.resolve(__dirname, "../../../db/migrations/001_initial_schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    const requiredTables = [
      "users", "suppliers", "categories", "materials",
      "pricing", "pricing_history", "scrape_runs",
      "projects", "project_bom",
    ];

    for (const table of requiredTables) {
      expect(sql, `missing table: ${table}`).toContain(`CREATE TABLE ${table}`);
    }

    expect(sql).toContain("v_material_pricing");
    expect(sql).toContain("v_project_cost");
    expect(sql).toContain("pgcrypto");
    expect(sql).toContain("uuid_generate_v4");
  });

  it("schema has proper constraints and indexes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.resolve(__dirname, "../../../db/migrations/001_initial_schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    expect(sql).toContain("UNIQUE");
    expect(sql).toContain("REFERENCES");
    expect(sql).toContain("ON DELETE");
    expect(sql).toContain("CHECK");
  });

  it("002_seed has all suppliers and materials", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.resolve(__dirname, "../../../db/migrations/002_seed_from_json.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    const requiredSuppliers = [
      "sarokas", "k-rauta", "ruukki", "tikkurila", "paroc", "lakan-betoni",
    ];
    for (const s of requiredSuppliers) {
      expect(sql, `missing supplier: ${s}`).toContain(`'${s}'`);
    }

    const requiredMaterials = [
      "pine_48x98_c24", "osb_9mm", "galvanized_roofing",
      "insulation_100mm", "screws_50mm", "concrete_block",
    ];
    for (const m of requiredMaterials) {
      expect(sql, `missing material: ${m}`).toContain(`'${m}'`);
    }
  });

  it("006_email_verification.sql has required columns", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.resolve(__dirname, "../../../db/migrations/006_email_verification.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    expect(sql).toContain("email_verified");
    expect(sql).toContain("verification_token");
    expect(sql).toContain("verification_token_expires");
  });

  it("seed has pricing entries for key materials", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.resolve(__dirname, "../../../db/migrations/002_seed_from_json.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    expect(sql).toContain("INSERT INTO pricing");
    expect(sql).toContain("is_primary");
    expect(sql).toContain("4.90");
    expect(sql).toContain("15.00");
  });

  it("seed creates default admin user", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.resolve(__dirname, "../../../db/migrations/002_seed_from_json.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    expect(sql).toContain("admin@helscoop.local");
    expect(sql).toContain("admin");
    expect(sql).toContain("password_hash");
  });
});

describe("Scraper", () => {
  it("scraper entry point exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const scraperPath = path.resolve(__dirname, "../../../scraper/src/scrape.ts");
    expect(fs.existsSync(scraperPath)).toBe(true);
  });

  it("scraper has required imports", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const scraperPath = path.resolve(__dirname, "../../../scraper/src/scrape.ts");
    const src = fs.readFileSync(scraperPath, "utf-8");

    expect(src).toContain("cheerio");
    expect(src).toContain("pg");
    expect(src).toContain("scrape_runs");
  });
});

describe("Chat endpoint", () => {
  it("chat route has local fallback responses", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const chatPath = path.resolve(__dirname, "../routes/chat.ts");
    const src = fs.readFileSync(chatPath, "utf-8");

    expect(src).toContain("generateLocalResponse");
    expect(src).toContain("SYSTEM_PROMPT");
    expect(src).toContain("box(");
    expect(src).toContain("translate(");
  });
});

describe("Web app", () => {
  it("has all required pages", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const pages = [
      "../../../web/src/app/page.tsx",
      "../../../web/src/app/layout.tsx",
      "../../../web/src/app/globals.css",
      "../../../web/src/app/project/[id]/page.tsx",
      "../../../web/src/app/admin/page.tsx",
      "../../../web/src/lib/api.ts",
      "../../../web/src/app/verify-email/page.tsx",
    ];

    for (const page of pages) {
      const pagePath = path.resolve(__dirname, page);
      expect(fs.existsSync(pagePath), `missing: ${page}`).toBe(true);
    }
  });

  it("API client has all required methods", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const apiPath = path.resolve(__dirname, "../../../web/src/lib/api.ts");
    const src = fs.readFileSync(apiPath, "utf-8");

    const requiredMethods = [
      "login", "register", "me",
      "getProjects", "getProject", "createProject",
      "updateProject", "deleteProject", "duplicateProject",
      "getMaterials", "getSuppliers", "getStalePrices",
      "exportBOM", "chat",
      "verifyEmail", "resendVerification",
    ];

    for (const method of requiredMethods) {
      expect(src, `missing API method: ${method}`).toContain(method);
    }
  });

  it("design system CSS has all required tokens", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cssPath = path.resolve(__dirname, "../../../web/src/app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    const tokens = [
      "--bg-primary", "--bg-secondary", "--text-primary", "--text-muted",
      "--accent", "--success", "--danger", "--border",
      "--radius-sm", "--radius-md", "--shadow-sm",
      "--font-sans", "--font-mono",
    ];

    for (const token of tokens) {
      expect(css, `missing CSS token: ${token}`).toContain(token);
    }
  });
});

describe("Building endpoint security", () => {
  it("building route has rate limiting and input validation", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const buildingPath = path.resolve(__dirname, "../routes/building.ts");
    const src = fs.readFileSync(buildingPath, "utf-8");

    // Input length validation
    expect(src).toContain("MAX_ADDRESS_LENGTH");
    expect(src).toContain("200");

    // LRU cache
    expect(src).toContain("buildingCache");
    expect(src).toContain("CACHE_MAX_SIZE");
    expect(src).toContain("CACHE_TTL_MS");
    expect(src).toContain("getCached");
    expect(src).toContain("setCache");
  });

  it("index.ts has building-specific rate limiters", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const indexPath = path.resolve(__dirname, "../index.ts");
    const src = fs.readFileSync(indexPath, "utf-8");

    // Building-specific rate limiter
    expect(src).toContain("buildingLimiter");
    expect(src).toContain("buildingLimiterAuthenticated");

    // Abuse logging
    expect(src).toContain("RATE_LIMIT");
    expect(src).toContain("Building endpoint rate limit hit");
  });

  it("building normalizeAddress handles edge cases", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const buildingPath = path.resolve(__dirname, "../routes/building.ts");
    const src = fs.readFileSync(buildingPath, "utf-8");

    // normalizeAddress exists
    expect(src).toContain("function normalizeAddress");
    // Handles commas, dots, dashes
    expect(src).toContain("toLowerCase");
  });
});

describe("Docker", () => {
  it("docker-compose.yml has all services", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const composePath = path.resolve(__dirname, "../../../docker-compose.yml");
    const yml = fs.readFileSync(composePath, "utf-8");

    expect(yml).toContain("db:");
    expect(yml).toContain("api:");
    expect(yml).toContain("web:");
    expect(yml).toContain("scraper:");
    expect(yml).toContain("postgres:16-alpine");
    expect(yml).toContain("healthcheck:");
  });
});

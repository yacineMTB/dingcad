-- Helscoop database schema
-- Normalized design for materials, pricing, projects, and users

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Users & Auth
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- Suppliers
-- ============================================================

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,  -- e.g. 'k-rauta', 'sarokas'
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  region TEXT NOT NULL DEFAULT 'Finland',
  logo_url TEXT,
  scrape_enabled BOOLEAN NOT NULL DEFAULT true,
  scrape_config JSONB DEFAULT '{}',  -- CSS selectors, URL patterns, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Categories
-- ============================================================

CREATE TABLE categories (
  id TEXT PRIMARY KEY,  -- e.g. 'lumber', 'roofing'
  display_name TEXT NOT NULL,
  display_name_fi TEXT,  -- Finnish name
  sort_order INT NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- Materials
-- ============================================================

CREATE TABLE materials (
  id TEXT PRIMARY KEY,  -- e.g. 'pine_48x98_c24'
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  tags TEXT[] DEFAULT '{}',
  description TEXT,

  -- Visual properties (PBR)
  visual_albedo REAL[3],
  visual_roughness REAL DEFAULT 0.5,
  visual_metallic REAL DEFAULT 0.0,
  visual_albedo_texture TEXT,
  visual_normal_texture TEXT,

  -- Thermal properties
  thermal_conductivity REAL,
  thermal_thickness REAL,  -- mm

  -- Structural properties
  structural_grade_class TEXT,
  structural_max_span_floor_mm REAL,
  structural_max_span_wall_mm REAL,
  structural_max_span_rafter_mm REAL,
  structural_bending_strength_mpa REAL,
  structural_modulus_gpa REAL,

  -- Product dimensions (for sheet/board materials)
  dimension_width_mm REAL,
  dimension_height_mm REAL,
  dimension_thickness_mm REAL,
  dimension_length_mm REAL,

  -- Paint/coating specific
  coverage_sqm_per_unit REAL,  -- e.g. sqm per liter
  waste_factor REAL DEFAULT 1.05,  -- 5% waste default

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_materials_category ON materials(category_id);
CREATE INDEX idx_materials_tags ON materials USING GIN(tags);

-- ============================================================
-- Pricing (current prices per supplier)
-- ============================================================

CREATE TABLE pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,  -- 'jm', 'sqm', 'sheet', 'kpl', 'box', 'liter', 'säkki'
  unit_price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  sku TEXT,        -- supplier's product code
  ean TEXT,        -- EAN/barcode
  link TEXT,       -- product page URL
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- primary supplier for this material
  last_scraped_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(material_id, supplier_id)
);

CREATE INDEX idx_pricing_material ON pricing(material_id);
CREATE INDEX idx_pricing_supplier ON pricing(supplier_id);

-- ============================================================
-- Pricing History (append-only log of price changes)
-- ============================================================

CREATE TABLE pricing_history (
  id BIGSERIAL PRIMARY KEY,
  pricing_id UUID NOT NULL REFERENCES pricing(id) ON DELETE CASCADE,
  unit_price NUMERIC(10,2) NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT  -- 'scraper', 'manual', 'import'
);

CREATE INDEX idx_pricing_history_pricing ON pricing_history(pricing_id);
CREATE INDEX idx_pricing_history_date ON pricing_history(scraped_at);

-- ============================================================
-- Scrape Runs (audit log for scraper)
-- ============================================================

CREATE TABLE scrape_runs (
  id BIGSERIAL PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  materials_checked INT DEFAULT 0,
  prices_updated INT DEFAULT 0,
  errors INT DEFAULT 0,
  error_log TEXT
);

-- ============================================================
-- Projects
-- ============================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scene_js TEXT,  -- the main.js scene content
  display_scale REAL DEFAULT 0.1,
  thumbnail_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

-- ============================================================
-- Project BOM (bill of materials for a project)
-- ============================================================

CREATE TABLE project_bom (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_bom_project ON project_bom(project_id);

-- ============================================================
-- Helper views
-- ============================================================

CREATE VIEW v_material_pricing AS
SELECT
  m.id AS material_id,
  m.name AS material_name,
  m.category_id,
  c.display_name AS category_name,
  p.supplier_id,
  s.name AS supplier_name,
  p.unit,
  p.unit_price,
  p.currency,
  p.sku,
  p.ean,
  p.link,
  p.is_primary,
  p.last_scraped_at,
  m.waste_factor
FROM materials m
JOIN categories c ON m.category_id = c.id
LEFT JOIN pricing p ON m.id = p.material_id
LEFT JOIN suppliers s ON p.supplier_id = s.id;

CREATE VIEW v_project_cost AS
SELECT
  pb.project_id,
  pb.material_id,
  m.name AS material_name,
  c.display_name AS category_name,
  pb.quantity,
  pb.unit,
  p.unit_price,
  (pb.quantity * p.unit_price * m.waste_factor) AS total_cost,
  s.name AS supplier_name,
  p.link
FROM project_bom pb
JOIN materials m ON pb.material_id = m.id
JOIN categories c ON m.category_id = c.id
LEFT JOIN pricing p ON m.id = p.material_id AND p.is_primary = true
LEFT JOIN suppliers s ON p.supplier_id = s.id;

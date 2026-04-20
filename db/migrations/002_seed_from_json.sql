-- Seed data from existing materials.json
-- Prices updated with real K-Rauta/Sarokas/Ruukki market data (April 2025)

-- ============================================================
-- Suppliers
-- ============================================================

INSERT INTO suppliers (id, name, url, currency, region, scrape_config) VALUES
  ('sarokas', 'Sarokas', 'https://www.sarokas.fi', 'EUR', 'Finland',
   '{"baseUrl": "https://www.sarokas.fi", "priceSelector": ".product-price", "type": "html"}'),
  ('k-rauta', 'K-Rauta', 'https://www.k-rauta.fi', 'EUR', 'Finland',
   '{"baseUrl": "https://www.k-rauta.fi", "priceSelector": "[data-price]", "type": "html"}'),
  ('ruukki', 'Ruukki', 'https://www.ruukki.com/fin', 'EUR', 'Finland',
   '{"baseUrl": "https://www.ruukki.com/fin", "type": "manual"}'),
  ('tikkurila', 'Tikkurila', 'https://www.tikkurila.fi', 'EUR', 'Finland',
   '{"baseUrl": "https://www.tikkurila.fi", "type": "manual"}'),
  ('paroc', 'Paroc', 'https://www.paroc.fi', 'EUR', 'Finland',
   '{"baseUrl": "https://www.paroc.fi", "type": "manual"}'),
  ('lakan-betoni', 'Lakan Betoni', 'https://www.lakanbetoni.fi', 'EUR', 'Finland',
   '{"baseUrl": "https://www.lakanbetoni.fi", "type": "manual"}');

-- ============================================================
-- Categories
-- ============================================================

INSERT INTO categories (id, display_name, display_name_fi, sort_order, hidden) VALUES
  ('lumber', 'Lumber', 'Sahatavara', 1, false),
  ('foundation', 'Foundation', 'Perustus', 2, false),
  ('sheathing', 'Panels', 'Levyt', 3, false),
  ('cladding', 'Cladding', 'Verhous', 4, false),
  ('roofing', 'Roofing', 'Katto', 5, false),
  ('insulation', 'Insulation', 'Eristeet', 6, false),
  ('membrane', 'Membranes', 'Kalvot', 7, false),
  ('finish', 'Finishes', 'Pintakäsittely', 8, false),
  ('hardware', 'Hardware', 'Tarvikkeet', 9, false),
  ('fasteners', 'Fasteners', 'Kiinnikkeet', 10, false),
  ('masonry', 'Masonry', 'Muuraus', 11, false),
  ('interior', 'Interior', 'Sisustus', 12, false),
  ('trim', 'Trim', 'Listat', 13, false),
  ('opening', 'Openings', 'Aukot', 14, false),
  ('assembly_preview', 'Preview', 'Esikatselu', 99, true);

-- ============================================================
-- Materials
-- ============================================================

INSERT INTO materials (id, name, category_id, tags, visual_albedo, visual_roughness, visual_metallic, visual_albedo_texture, thermal_conductivity, thermal_thickness, structural_grade_class, structural_max_span_floor_mm, structural_max_span_wall_mm, structural_max_span_rafter_mm, structural_bending_strength_mpa, structural_modulus_gpa, dimension_thickness_mm, waste_factor) VALUES
  ('pine_48x98_c24', '48x98 Runkopuu C24', 'lumber', ARRAY['structural','softwood','framing'], ARRAY[1.0,0.95,0.85], 0.85, 0.0, 'textures/wood/pine_albedo.png', 0.12, 98, 'C24', 2500, 2700, 2200, 24, 11, 98, 1.10),
  ('pine_48x148_c24', '48x148 Lattiavasat C24', 'lumber', ARRAY['structural','softwood','joists'], ARRAY[1.0,0.95,0.85], 0.85, 0.0, 'textures/wood/pine_albedo.png', 0.12, 148, 'C24', 4000, 3500, 3500, 24, 11, 148, 1.10),
  ('pressure_treated_48x148', 'Kestopuu 48x148', 'lumber', ARRAY['structural','treated','exterior','ground-contact'], ARRAY[0.65,0.72,0.55], 0.80, 0.0, 'textures/wood/pine_albedo.png', 0.12, 148, 'C24', 4000, 3500, 3500, 24, 11, 148, 1.10),
  ('pressure_treated_148x148', 'Kestopuu Jalka 148x148', 'foundation', ARRAY['structural','treated','exterior','ground-contact','skid'], ARRAY[0.60,0.68,0.50], 0.82, 0.0, 'textures/wood/pine_albedo.png', 0.12, 148, NULL, NULL, NULL, NULL, NULL, NULL, 148, 1.05),
  ('osb_9mm', 'OSB 9mm Levy', 'sheathing', ARRAY['composite','structural','wall'], ARRAY[1.0,1.0,1.0], 0.90, 0.0, 'textures/osb/osb_albedo.png', 0.13, 9, NULL, NULL, NULL, NULL, NULL, NULL, 9, 1.08),
  ('osb_18mm', 'OSB 18mm Lattia', 'sheathing', ARRAY['composite','structural','floor'], ARRAY[1.0,1.0,1.0], 0.88, 0.0, 'textures/osb/osb_albedo.png', 0.13, 18, NULL, NULL, NULL, NULL, NULL, NULL, 18, 1.08),
  ('exterior_board_yellow', 'Ulkoverhouslauta Keltainen', 'cladding', ARRAY['wood','exterior','cladding','finnish','yellow','painted'], ARRAY[0.95,0.82,0.28], 0.45, 0.0, NULL, 0.12, 21, NULL, NULL, NULL, NULL, NULL, NULL, 21, 1.12),
  ('galvanized_roofing', 'Peltikatto Sinkitty', 'roofing', ARRAY['metal','exterior','roof'], ARRAY[0.75,0.76,0.78], 0.30, 0.98, 'textures/metal/galvanized_albedo.png', 50.0, 0.5, NULL, NULL, NULL, NULL, NULL, NULL, 0.5, 1.10),
  ('galvanized_flashing', 'Pellitys Sinkitty', 'roofing', ARRAY['metal','exterior','flashing'], ARRAY[0.70,0.70,0.73], 0.30, 1.0, 'textures/metal/galvanized_albedo.png', 50.0, 0.5, NULL, NULL, NULL, NULL, NULL, NULL, 0.5, 1.05),
  ('hardware_cloth', 'Verkko 12.5mm Sinkitty', 'hardware', ARRAY['metal','mesh','chicken-wire'], ARRAY[0.65,0.65,0.68], 0.40, 0.9, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.05),
  ('insulation_100mm', 'Mineraalivilla 100mm', 'insulation', ARRAY['thermal','wall','mineral-wool'], ARRAY[0.95,0.92,0.55], 0.95, 0.0, NULL, 0.035, 100, NULL, NULL, NULL, NULL, NULL, NULL, 100, 1.05),
  ('vapor_barrier', 'Höyrynsulku PE', 'membrane', ARRAY['plastic','vapor','barrier'], ARRAY[0.15,0.15,0.18], 0.20, 0.0, NULL, 0.33, 0.2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.10),
  ('exterior_paint_red', 'Punamulta Ulkomaali', 'finish', ARRAY['paint','exterior','traditional'], ARRAY[0.65,0.22,0.15], 0.60, 0.0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('exterior_paint_yellow', 'Keltainen Ulkomaali', 'finish', ARRAY['paint','exterior','traditional','finnish'], ARRAY[0.92,0.78,0.35], 0.55, 0.0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('exterior_paint_gray_door', 'Harmaa Ovimaali', 'finish', ARRAY['paint','exterior','door','finnish'], ARRAY[0.45,0.48,0.52], 0.50, 0.0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('exterior_paint_white', 'Valkoinen Ulkomaali', 'finish', ARRAY['paint','exterior','trim'], ARRAY[0.96,0.95,0.93], 0.40, 0.0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('hinges_galvanized', 'Saranat Sinkitty', 'hardware', ARRAY['metal','hinge','door'], ARRAY[0.68,0.68,0.70], 0.35, 1.0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('joist_hanger', 'Palkinkannatin 48mm', 'hardware', ARRAY['metal','structural','connector'], ARRAY[0.72,0.72,0.74], 0.30, 1.0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('screws_50mm', 'Ruuvit 4.5x50mm', 'fasteners', ARRAY['metal','screw','exterior'], ARRAY[0.60,0.58,0.55], 0.45, 0.95, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('concrete_block', 'Betoniharkko 200mm', 'masonry', ARRAY['concrete','foundation','structural'], ARRAY[0.55,0.55,0.52], 0.90, 0.0, 'textures/concrete/concrete_albedo.png', 1.7, 200, NULL, NULL, NULL, NULL, NULL, NULL, 200, 1.05),
  ('builders_sand', 'Rakennushiekka 25kg', 'masonry', ARRAY['sand','foundation','leveling'], ARRAY[0.85,0.78,0.60], 0.95, 0.0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1.0),
  ('nest_box_plywood', 'Vaneri 12mm Pesälaatikko', 'interior', ARRAY['plywood','interior','nest'], ARRAY[0.55,0.42,0.30], 0.70, 0.0, 'textures/plywood/plywood_albedo.png', 0.13, 12, NULL, NULL, NULL, NULL, NULL, NULL, 12, 1.08),
  ('trim_21x45', 'Lista 21x45', 'trim', ARRAY['softwood','trim','exterior'], ARRAY[0.88,0.78,0.58], 0.65, 0.0, NULL, 0.12, 21, NULL, NULL, NULL, NULL, NULL, NULL, 21, 1.10),
  ('cedar_post_98x98', 'Kestopuu Tolppa 98x98', 'lumber', ARRAY['structural','treated','exterior','post','run'], ARRAY[0.62,0.70,0.52], 0.75, 0.0, 'textures/wood/pine_albedo.png', NULL, NULL, 'C18', 0, 3000, 0, 18, 9, 98, 1.05);

-- Building demo materials (house import BOM)
INSERT INTO materials (id, name, category_id, tags, visual_albedo, visual_roughness, visual_metallic, thermal_conductivity, thermal_thickness, dimension_thickness_mm, waste_factor) VALUES
  ('osb_11mm', 'OSB-levy 11mm', 'sheathing', ARRAY['composite','structural','wall','sheathing'], ARRAY[1.0,1.0,1.0], 0.90, 0.0, 0.13, 11, 11, 1.05),
  ('mineral_wool_150', 'Mineraalivilla 150mm', 'insulation', ARRAY['thermal','wall','mineral-wool'], ARRAY[0.95,0.92,0.55], 0.95, 0.0, 0.035, 150, 150, 1.05),
  ('concrete_c25', 'Betoni C25/30', 'foundation', ARRAY['concrete','foundation','structural'], ARRAY[0.55,0.55,0.52], 0.90, 0.0, 1.7, 200, NULL, 1.05),
  ('metal_roof_ruukki', 'Peltikate Ruukki Classic', 'roofing', ARRAY['metal','exterior','roof','ruukki'], ARRAY[0.35,0.15,0.12], 0.25, 0.98, 50.0, 0.5, NULL, 1.05),
  ('gypsum_board_13mm', 'Kipsilevy 13mm', 'interior', ARRAY['gypsum','interior','wall','ceiling'], ARRAY[0.92,0.92,0.90], 0.80, 0.0, 0.22, 13, 13, 1.05),
  ('wind_barrier', 'Tuulensuojalevy', 'membrane', ARRAY['board','exterior','wind-barrier'], ARRAY[0.60,0.55,0.45], 0.85, 0.0, 0.065, 9, 9, 1.05),
  ('wood_screw_5x80', 'Puuruuvi 5x80mm', 'fasteners', ARRAY['metal','screw','exterior','structural'], ARRAY[0.60,0.58,0.55], 0.45, 0.95, NULL, NULL, NULL, 1.05);

-- Materials without pricing (thermal bridges, preview)
INSERT INTO materials (id, name, category_id, tags, visual_albedo, visual_roughness, visual_metallic, thermal_conductivity, thermal_thickness) VALUES
  ('door_thermal_bridge', 'Ovi (lämpösilta)', 'opening', ARRAY['thermal-bridge','door','weak-point'], ARRAY[0.42,0.46,0.52], 0.50, 0.0, 0.12, 45),
  ('vent_thermal_bridge', 'Tuuletusaukko (lämpösilta)', 'opening', ARRAY['thermal-bridge','vent','weak-point'], ARRAY[0.3,0.3,0.35], 0.50, 0.5, 25.0, 1),
  ('nest_access_thermal_bridge', 'Pesälaatikkoaukko (lämpösilta)', 'opening', ARRAY['thermal-bridge','nest','weak-point'], ARRAY[0.75,0.65,0.50], 0.65, 0.0, 0.13, 12);

INSERT INTO materials (id, name, category_id, tags, visual_albedo, visual_roughness, visual_metallic, visual_albedo_texture) VALUES
  ('assembly_lumber_preview', 'Esikatselu Runko', 'assembly_preview', ARRAY['preview','assembly','temporary'], ARRAY[0.85,0.72,0.52], 0.75, 0.0, 'textures/wood/pine_albedo.png');

-- ============================================================
-- Pricing (real market prices, April 2025)
-- ============================================================

INSERT INTO pricing (material_id, supplier_id, unit, unit_price, link, is_primary, last_scraped_at, last_verified_at) VALUES
  -- Lumber (Sarokas primary, K-Rauta alternative)
  ('pine_48x98_c24', 'sarokas', 'jm', 2.60, 'https://www.sarokas.fi/mitallistettu-48x98-c24', true, now(), now()),
  ('pine_48x148_c24', 'sarokas', 'jm', 3.70, 'https://www.sarokas.fi/mitallistettu-48x148-c24', true, now(), now()),
  ('pressure_treated_48x148', 'k-rauta', 'jm', 4.90, 'https://www.k-rauta.fi/tuote/runko-prof-kestopuu-vihrea-48x148-ntra-3-6-metria/6438313557401', true, now(), now()),
  ('pressure_treated_48x148', 'sarokas', 'jm', 3.80, 'https://www.sarokas.fi/kestopuu-48-148-vihrea', false, now(), now()),
  ('pressure_treated_148x148', 'sarokas', 'jm', 12.50, 'https://www.sarokas.fi/kestopuu-148x148-vihrea', true, now(), now()),
  ('cedar_post_98x98', 'k-rauta', 'jm', 8.50, 'https://www.k-rauta.fi/tuote/kestopuu-tolppa', true, now(), now()),

  -- Panels (K-Rauta primary)
  ('osb_9mm', 'k-rauta', 'sheet', 15.00, 'https://www.k-rauta.fi/kategoria/rakennusmateriaalit/rakennuslevyt/osb-levyt', true, now(), now()),
  ('osb_18mm', 'k-rauta', 'sheet', 32.00, 'https://www.k-rauta.fi/kategoria/rakennusmateriaalit/rakennuslevyt/osb-levyt', true, now(), now()),
  ('nest_box_plywood', 'k-rauta', 'sheet', 45.79, 'https://www.k-rauta.fi/tuote/vaneri-12mm', true, now(), now()),
  ('exterior_board_yellow', 'k-rauta', 'sheet', 28.00, 'https://www.k-rauta.fi/tuote/vaneri-9mm-ulko', true, now(), now()),

  -- Roofing (Ruukki primary)
  ('galvanized_roofing', 'ruukki', 'sqm', 15.00, 'https://www.ruukki.com/fin/katto', true, now(), now()),
  ('galvanized_flashing', 'ruukki', 'jm', 12.00, 'https://www.ruukki.com/fin/pellitys', true, now(), now()),

  -- Insulation (Paroc primary, K-Rauta retailer)
  ('insulation_100mm', 'k-rauta', 'sqm', 12.34, 'https://www.k-rauta.fi/tuote/yleiseriste-paroc-extra-100-565x1170529m/6438085418122', true, now(), now()),
  ('insulation_100mm', 'paroc', 'sqm', 10.50, 'https://www.paroc.fi/tuotteet/seinaeristeet', false, now(), now()),

  -- Membranes
  ('vapor_barrier', 'k-rauta', 'sqm', 0.80, 'https://www.k-rauta.fi/tuote/hoyrynsulku', true, now(), now()),

  -- Hardware (K-Rauta primary)
  ('hardware_cloth', 'k-rauta', 'sqm', 8.00, 'https://www.k-rauta.fi/tuote/verkko-sinkitty', true, now(), now()),
  ('hinges_galvanized', 'k-rauta', 'kpl', 5.48, 'https://www.k-rauta.fi/tuote/t-sarana-prof-100mm-sinkitty-musta-2kpl/6410404781131', true, now(), now()),
  ('joist_hanger', 'k-rauta', 'kpl', 3.19, 'https://www.k-rauta.fi/tuote/palkkikenka-prof-i-48x96mm/5709416005511', true, now(), now()),
  ('screws_50mm', 'k-rauta', 'box', 13.95, 'https://www.k-rauta.fi/tuote/yleisruuvi-prof-uppokanta-5x50-sahkosinkitty-t25-200kpl/6405422902132', true, now(), now()),

  -- Masonry
  ('concrete_block', 'k-rauta', 'kpl', 5.01, 'https://www.k-rauta.fi/tuote/betonivaluharkko-leca-bvh-200-200x498x200mm/6430081480851', true, now(), now()),
  ('builders_sand', 'k-rauta', 'säkki', 4.50, 'https://www.k-rauta.fi/tuote/rakennushiekka', true, now(), now()),

  -- Finishes (Tikkurila primary)
  ('exterior_paint_red', 'tikkurila', 'liter', 12.00, 'https://www.tikkurila.fi/punamulta', true, now(), now()),
  ('exterior_paint_yellow', 'tikkurila', 'liter', 14.00, 'https://www.tikkurila.fi/ulkomaali', true, now(), now()),
  ('exterior_paint_gray_door', 'tikkurila', 'liter', 16.00, 'https://www.tikkurila.fi/ovimaali', true, now(), now()),
  ('exterior_paint_white', 'tikkurila', 'liter', 15.00, 'https://www.tikkurila.fi/ulkomaali', true, now(), now()),

  -- Trim
  ('trim_21x45', 'sarokas', 'jm', 1.20, 'https://www.sarokas.fi/lista-21x45', true, now(), now()),

  -- Building demo materials (house import BOM)
  ('osb_11mm', 'k-rauta', 'm2', 8.50, 'https://www.k-rauta.fi/tuote/osb-levy-11mm', true, now(), now()),
  ('mineral_wool_150', 'paroc', 'm2', 12.90, 'https://www.paroc.fi/tuotteet/extra', true, now(), now()),
  ('concrete_c25', 'lakan-betoni', 'm3', 120.00, 'https://www.lakanbetoni.fi/betoni', true, now(), now()),
  ('metal_roof_ruukki', 'ruukki', 'm2', 18.50, 'https://www.ruukki.com/fin/katto/peltikate', true, now(), now()),
  ('gypsum_board_13mm', 'k-rauta', 'm2', 5.80, 'https://www.k-rauta.fi/tuote/kipsilevy-13mm', true, now(), now()),
  ('wind_barrier', 'k-rauta', 'm2', 4.20, 'https://www.k-rauta.fi/tuote/tuulensuojalevy', true, now(), now()),
  ('wood_screw_5x80', 'k-rauta', 'kpl', 0.08, 'https://www.k-rauta.fi/tuote/puuruuvi-5x80', true, now(), now());

-- Seed initial pricing history from current prices
INSERT INTO pricing_history (pricing_id, unit_price, scraped_at, source)
SELECT id, unit_price, now(), 'import' FROM pricing;

-- Create a default admin user (password: admin123 — change immediately)
INSERT INTO users (email, name, password_hash, role) VALUES
  ('admin@helscoop.local', 'Admin', crypt('admin123', gen_salt('bf')), 'admin');

-- Add Finnish and English name columns to materials for localization
-- The existing `name` column contains the primary/display name (mostly Finnish).
-- name_fi and name_en provide explicit translations for the BOM panel UI.

ALTER TABLE materials ADD COLUMN IF NOT EXISTS name_fi TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS name_en TEXT;

-- Populate translations for all existing materials
UPDATE materials SET name_fi = '48x98 Runkopuu C24',               name_en = '48x98 Framing Timber C24'        WHERE id = 'pine_48x98_c24';
UPDATE materials SET name_fi = '48x148 Lattiavasat C24',            name_en = '48x148 Floor Joists C24'          WHERE id = 'pine_48x148_c24';
UPDATE materials SET name_fi = 'Kestopuu 48x148',                   name_en = 'Pressure Treated 48x148'          WHERE id = 'pressure_treated_48x148';
UPDATE materials SET name_fi = 'Kestopuu Jalka 148x148',            name_en = 'Pressure Treated Skid 148x148'    WHERE id = 'pressure_treated_148x148';
UPDATE materials SET name_fi = 'OSB 9mm Levy',                      name_en = 'OSB 9mm Panel'                    WHERE id = 'osb_9mm';
UPDATE materials SET name_fi = 'OSB 18mm Lattia',                   name_en = 'OSB 18mm Floor Panel'             WHERE id = 'osb_18mm';
UPDATE materials SET name_fi = 'Ulkoverhouslauta Keltainen',        name_en = 'Exterior Cladding Board Yellow'   WHERE id = 'exterior_board_yellow';
UPDATE materials SET name_fi = 'Peltikatto Sinkitty',               name_en = 'Galvanized Steel Roofing'         WHERE id = 'galvanized_roofing';
UPDATE materials SET name_fi = 'Pellitys Sinkitty',                 name_en = 'Galvanized Flashing'              WHERE id = 'galvanized_flashing';
UPDATE materials SET name_fi = 'Verkko 12.5mm Sinkitty',            name_en = 'Hardware Cloth 12.5mm Galvanized'  WHERE id = 'hardware_cloth';
UPDATE materials SET name_fi = 'Mineraalivilla 100mm',              name_en = 'Mineral Wool Insulation 100mm'    WHERE id = 'insulation_100mm';
UPDATE materials SET name_fi = 'Höyrynsulku PE',                    name_en = 'PE Vapor Barrier'                 WHERE id = 'vapor_barrier';
UPDATE materials SET name_fi = 'Punamulta Ulkomaali',               name_en = 'Red Ochre Exterior Paint'         WHERE id = 'exterior_paint_red';
UPDATE materials SET name_fi = 'Keltainen Ulkomaali',               name_en = 'Yellow Exterior Paint'            WHERE id = 'exterior_paint_yellow';
UPDATE materials SET name_fi = 'Harmaa Ovimaali',                   name_en = 'Gray Door Paint'                  WHERE id = 'exterior_paint_gray_door';
UPDATE materials SET name_fi = 'Valkoinen Ulkomaali',               name_en = 'White Exterior Paint'             WHERE id = 'exterior_paint_white';
UPDATE materials SET name_fi = 'Saranat Sinkitty',                  name_en = 'Galvanized Hinges'                WHERE id = 'hinges_galvanized';
UPDATE materials SET name_fi = 'Palkinkannatin 48mm',               name_en = 'Joist Hanger 48mm'                WHERE id = 'joist_hanger';
UPDATE materials SET name_fi = 'Ruuvit 4.5x50mm',                  name_en = 'Screws 4.5x50mm'                  WHERE id = 'screws_50mm';
UPDATE materials SET name_fi = 'Betoniharkko 200mm',                name_en = 'Concrete Block 200mm'             WHERE id = 'concrete_block';
UPDATE materials SET name_fi = 'Rakennushiekka 25kg',               name_en = 'Builder''s Sand 25kg'             WHERE id = 'builders_sand';
UPDATE materials SET name_fi = 'Vaneri 12mm Pesälaatikko',          name_en = 'Plywood 12mm Nest Box'            WHERE id = 'nest_box_plywood';
UPDATE materials SET name_fi = 'Lista 21x45',                       name_en = 'Trim Board 21x45'                 WHERE id = 'trim_21x45';
UPDATE materials SET name_fi = 'Kestopuu Tolppa 98x98',             name_en = 'Treated Post 98x98'               WHERE id = 'cedar_post_98x98';
UPDATE materials SET name_fi = 'OSB-levy 11mm',                     name_en = 'OSB Panel 11mm'                   WHERE id = 'osb_11mm';
UPDATE materials SET name_fi = 'Mineraalivilla 150mm',              name_en = 'Mineral Wool Insulation 150mm'    WHERE id = 'mineral_wool_150';
UPDATE materials SET name_fi = 'Betoni C25/30',                     name_en = 'Concrete C25/30'                  WHERE id = 'concrete_c25';
UPDATE materials SET name_fi = 'Peltikate Ruukki Classic',          name_en = 'Ruukki Classic Metal Roof'        WHERE id = 'metal_roof_ruukki';
UPDATE materials SET name_fi = 'Kipsilevy 13mm',                   name_en = 'Gypsum Board 13mm'                WHERE id = 'gypsum_board_13mm';
UPDATE materials SET name_fi = 'Tuulensuojalevy',                   name_en = 'Wind Barrier Board'               WHERE id = 'wind_barrier';
UPDATE materials SET name_fi = 'Puuruuvi 5x80mm',                  name_en = 'Wood Screw 5x80mm'                WHERE id = 'wood_screw_5x80';
UPDATE materials SET name_fi = 'Ovi (lämpösilta)',                  name_en = 'Door (thermal bridge)'            WHERE id = 'door_thermal_bridge';
UPDATE materials SET name_fi = 'Tuuletusaukko (lämpösilta)',        name_en = 'Vent (thermal bridge)'            WHERE id = 'vent_thermal_bridge';
UPDATE materials SET name_fi = 'Pesälaatikkoaukko (lämpösilta)',    name_en = 'Nest Access (thermal bridge)'     WHERE id = 'nest_access_thermal_bridge';
UPDATE materials SET name_fi = 'Esikatselu Runko',                  name_en = 'Preview Frame'                    WHERE id = 'assembly_lumber_preview';

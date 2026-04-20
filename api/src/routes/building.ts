import { Router, Request, Response } from "express";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

// ---------------------------------------------------------------------------
// In-memory LRU cache for building lookup results
// Max 1000 entries, 5-minute TTL per entry
// ---------------------------------------------------------------------------
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const buildingCache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = buildingCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    buildingCache.delete(key);
    return null;
  }
  // Move to end for LRU ordering (Map preserves insertion order)
  buildingCache.delete(key);
  buildingCache.set(key, entry);
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  // Evict oldest entries if at capacity
  if (buildingCache.size >= CACHE_MAX_SIZE) {
    const oldest = buildingCache.keys().next().value;
    if (oldest !== undefined) {
      buildingCache.delete(oldest);
    }
  }
  buildingCache.set(key, { data, timestamp: Date.now() });
}

// Maximum allowed address length to prevent abuse
const MAX_ADDRESS_LENGTH = 200;

// Load demo building data at startup
interface BuildingInfo {
  type: string;
  year_built: number;
  material: string;
  floors: number;
  area_m2: number;
  heating: string;
  roof_type?: string;
  roof_material?: string;
  units?: number;
}

interface BomItem {
  material_id: string;
  quantity: number;
  unit: string;
}

interface BuildingData {
  address: string;
  coordinates: { lat: number; lon: number };
  building_info: BuildingInfo;
  scene_js: string;
  bom_suggestion: BomItem[];
}

function loadDemoData(): BuildingData[] {
  const dataDir = join(__dirname, "..", "..", "..", "data", "demo");
  const files = ["ribbingintie-109.json", "uunimaentie-1.json"];
  const buildings: BuildingData[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(dataDir, file), "utf-8");
      buildings.push(JSON.parse(raw));
    } catch (e) {
      console.warn(`Could not load demo data file ${file}:`, e);
    }
  }

  return buildings;
}

const demoBuildings = loadDemoData();

/**
 * Normalize an address string for fuzzy matching:
 * lowercase, collapse whitespace, strip commas and dots.
 */
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[,.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check whether a query address matches a demo address.
 * Matches if the normalized query contains the street name and number.
 */
function matchesDemoAddress(query: string, demoAddress: string): boolean {
  const normQ = normalizeAddress(query);
  const normD = normalizeAddress(demoAddress);

  // Extract the street name and number (first part before postal code)
  const streetPart = normD.split(/\d{5}/)[0].trim();
  if (!streetPart) return false;

  // Try exact substring match on the street portion
  if (normQ.includes(streetPart)) return true;

  // Also try matching just the street name (without house number suffix)
  const words = streetPart.split(" ");
  const streetName = words[0];
  if (streetName && streetName.length > 4 && normQ.includes(streetName)) {
    return true;
  }

  return false;
}

/**
 * Generate a generic building based on postal code area characteristics.
 */
function generateGenericBuilding(address: string): BuildingData {
  // Try to extract postal code
  const postalMatch = address.match(/\b(\d{5})\b/);
  const postalCode = postalMatch ? postalMatch[1] : "00100";
  const prefix = postalCode.substring(0, 2);

  // Helsinki downtown (001-002): likely apartment
  // Helsinki suburbs (003-009): likely detached/row house
  // Espoo (02): mixed
  // Vantaa (01): mixed suburban
  let buildingType = "omakotitalo";
  let floors = 2;
  let area = 120;
  let yearBuilt = 1990;
  let material = "puu";

  if (prefix === "00" && parseInt(postalCode) < 300) {
    buildingType = "kerrostalo";
    floors = 5;
    area = 65;
    yearBuilt = 1960;
    material = "betoni";
  } else if (prefix === "00" && parseInt(postalCode) >= 300) {
    buildingType = "omakotitalo";
    floors = 2;
    area = 130;
    yearBuilt = 1985;
    material = "puu";
  } else if (prefix === "02") {
    buildingType = "omakotitalo";
    floors = 2;
    area = 145;
    yearBuilt = 1995;
    material = "puu";
  }

  return {
    address,
    coordinates: { lat: 60.17, lon: 24.94 },
    building_info: {
      type: buildingType,
      year_built: yearBuilt,
      material: material,
      floors: floors,
      area_m2: area,
      heating: "kaukolampo",
      roof_type: "harjakatto",
      roof_material: "pelti",
    },
    scene_js: generateGenericScene(buildingType, floors, area),
    bom_suggestion: [
      { material_id: "pine_48x148_c24", quantity: Math.round(area * 0.6), unit: "jm" },
      { material_id: "pine_48x98_c24", quantity: Math.round(area * 0.4), unit: "jm" },
      { material_id: "osb_11mm", quantity: Math.round(area * 0.35), unit: "m2" },
      { material_id: "mineral_wool_150", quantity: Math.round(area * 0.7), unit: "m2" },
      { material_id: "concrete_c25", quantity: Math.round(area * 0.06 * 10) / 10, unit: "m3" },
      { material_id: "metal_roof_ruukki", quantity: Math.round(area * 0.55), unit: "m2" },
    ],
  };
}

function generateGenericScene(
  type: string,
  floors: number,
  area: number
): string {
  const floorHeight = 2.7;
  // Approximate footprint from area
  const ratio = 1.2; // length/width ratio
  const width = Math.sqrt(area / floors / ratio);
  const length = width * ratio;
  const w = Math.round(width * 10) / 10;
  const l = Math.round(length * 10) / 10;
  const wallThickness = 0.2;

  // Colors
  const foundationColor = "[0.55, 0.55, 0.52]";
  const wallFrontColor = "[0.76, 0.60, 0.42]";
  const wallBackColor = "[0.72, 0.56, 0.38]";
  const wallLeftColor = "[0.68, 0.53, 0.35]";
  const wallRightColor = "[0.70, 0.55, 0.37]";
  const slabColor = "[0.60, 0.60, 0.58]";
  const roofColor = "[0.25, 0.22, 0.20]";

  let lines = `// Generic ${type}, ${floors} floors, ~${area}m2\n\n`;

  // Foundation slab
  lines += `const foundation = translate(box(${l}, 0.3, ${w}), 0, 0.15, 0);\n`;
  lines += `scene.add(foundation, {material: "concrete", color: ${foundationColor}});\n\n`;

  for (let f = 0; f < floors; f++) {
    const baseY = 0.3 + f * (floorHeight + 0.25);
    const wallCenterY = (baseY + floorHeight / 2).toFixed(2);
    const prefix = f === 0 ? "gf" : `f${f}`;
    const floorLabel = f === 0 ? "Ground floor" : `Floor ${f + 1}`;

    lines += `// ${floorLabel} walls\n`;
    lines += `const ${prefix}_front = translate(box(${l}, ${floorHeight}, ${wallThickness}), 0, ${wallCenterY}, ${(-w / 2).toFixed(2)});\n`;
    lines += `scene.add(${prefix}_front, {material: "wood", color: ${wallFrontColor}});\n`;

    lines += `const ${prefix}_back = translate(box(${l}, ${floorHeight}, ${wallThickness}), 0, ${wallCenterY}, ${(w / 2).toFixed(2)});\n`;
    lines += `scene.add(${prefix}_back, {material: "wood", color: ${wallBackColor}});\n`;

    lines += `const ${prefix}_left = translate(box(${wallThickness}, ${floorHeight}, ${w}), ${(-l / 2).toFixed(2)}, ${wallCenterY}, 0);\n`;
    lines += `scene.add(${prefix}_left, {material: "wood", color: ${wallLeftColor}});\n`;

    lines += `const ${prefix}_right = translate(box(${wallThickness}, ${floorHeight}, ${w}), ${(l / 2).toFixed(2)}, ${wallCenterY}, 0);\n`;
    lines += `scene.add(${prefix}_right, {material: "wood", color: ${wallRightColor}});\n`;

    // Floor slab between stories
    if (f < floors - 1) {
      const slabY = (baseY + floorHeight + 0.125).toFixed(2);
      lines += `\n// Slab above ${floorLabel.toLowerCase()}\n`;
      lines += `const slab${f} = translate(box(${l}, 0.25, ${w}), 0, ${slabY}, 0);\n`;
      lines += `scene.add(slab${f}, {material: "concrete", color: ${slabColor}});\n`;
    }

    lines += `\n`;
  }

  // Pitched roof
  const totalH = 0.3 + floors * floorHeight + (floors - 1) * 0.25;
  const roofPeakH = totalH + w * 0.29; // ~30deg pitch
  const roofCenterY = ((totalH + roofPeakH) / 2).toFixed(2);
  const roofPanelDepth = (w / 2 + 0.6).toFixed(1);
  const roofPanelLength = (l + 0.6).toFixed(1);

  lines += `// Pitched roof\n`;
  lines += `const roof_left = translate(rotate(box(${roofPanelLength}, 0.08, ${roofPanelDepth}), 0.52, 0, 0), 0, ${roofCenterY}, ${(-w / 4).toFixed(2)});\n`;
  lines += `scene.add(roof_left, {material: "metal", color: ${roofColor}});\n`;

  lines += `const roof_right = translate(rotate(box(${roofPanelLength}, 0.08, ${roofPanelDepth}), -0.52, 0, 0), 0, ${roofCenterY}, ${(w / 4).toFixed(2)});\n`;
  lines += `scene.add(roof_right, {material: "metal", color: ${roofColor}});\n`;

  return lines;
}

// GET /building?address=<address>
router.get("/", (req: Request, res: Response) => {
  const address = (req.query.address as string) || "";

  // Input validation: minimum length
  if (!address || address.length < 3) {
    return res.status(400).json({ error: "Address query parameter required (min 3 characters)" });
  }

  // Input validation: maximum length to prevent abuse
  if (address.length > MAX_ADDRESS_LENGTH) {
    return res.status(400).json({ error: `Address must be ${MAX_ADDRESS_LENGTH} characters or fewer` });
  }

  // Check cache first
  const cacheKey = normalizeAddress(address);
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Try to match against demo buildings
  for (const building of demoBuildings) {
    if (matchesDemoAddress(address, building.address)) {
      const result = {
        ...building,
        confidence: "verified" as const,
        data_sources: ["Helsinki CityGML", "K-Rauta hinnat 04/2026"],
      };
      setCache(cacheKey, result);
      return res.json(result);
    }
  }

  // Fallback: generate generic building
  const generic = generateGenericBuilding(address);
  const result = {
    ...generic,
    confidence: "estimated" as const,
    data_sources: ["Yleinen kerrostalomalli"],
  };
  setCache(cacheKey, result);
  return res.json(result);
});

export default router;

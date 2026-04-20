/**
 * Helscoop Materials Library
 *
 * Provides material database loading and helpers for assigning
 * materials to geometry with visual properties and pricing info.
 */

// Global material database (loaded once)
let _materialsDb = null;

/**
 * Load materials database from JSON file
 * @param {string} path - Path to materials.json
 * @returns {Object} Materials database object
 */
export function loadMaterials(path = './materials/materials.json') {
  if (_materialsDb) return _materialsDb;

  // In QuickJS environment, we need to use synchronous file reading
  // This will be injected by the C++ runtime
  if (typeof __loadJSON !== 'undefined') {
    _materialsDb = __loadJSON(path);
  } else {
    // Fallback for testing - return empty db
    console.warn('Materials database not available - __loadJSON not defined');
    _materialsDb = { materials: {}, suppliers: {}, categories: {} };
  }

  return _materialsDb;
}

/**
 * Get a material by ID
 * @param {string} id - Material ID (e.g., 'pine_48x98_c24')
 * @returns {Object|null} Material object or null if not found
 */
export function getMaterial(id) {
  const db = loadMaterials();
  return db.materials[id] || null;
}

/**
 * Get all materials in a category
 * @param {string} category - Category name (e.g., 'lumber')
 * @returns {Object[]} Array of material objects
 */
export function getMaterialsByCategory(category) {
  const db = loadMaterials();
  return Object.entries(db.materials)
    .filter(([_, mat]) => mat.category === category)
    .map(([id, mat]) => ({ id, ...mat }));
}

/**
 * Search materials by tag
 * @param {string} tag - Tag to search for
 * @returns {Object[]} Array of matching materials
 */
export function getMaterialsByTag(tag) {
  const db = loadMaterials();
  return Object.entries(db.materials)
    .filter(([_, mat]) => mat.tags && mat.tags.includes(tag))
    .map(([id, mat]) => ({ id, ...mat }));
}

/**
 * Create a colored scene object with material reference
 * @param {Manifold} geometry - The geometry
 * @param {string} materialId - Material ID from database
 * @param {number} [quantity=1] - Quantity for BOM
 * @returns {Object} Scene object with geometry, material, and color
 */
export function withMaterial(geometry, materialId, quantity = 1) {
  const mat = getMaterial(materialId);

  if (!mat) {
    console.warn(`Material '${materialId}' not found in database`);
    return { geometry, material: materialId, quantity };
  }

  // Extract albedo color for rendering
  const albedo = mat.visual?.albedo || [0.8, 0.8, 0.8];

  return {
    geometry,
    material: materialId,
    color: albedo,
    quantity
  };
}

/**
 * Create a BOM entry from material and quantity
 * @param {string} materialId - Material ID
 * @param {number} quantity - Quantity
 * @returns {Object} BOM entry compatible with existing materials export
 */
export function bomEntry(materialId, quantity) {
  const mat = getMaterial(materialId);

  if (!mat) {
    return {
      name: materialId,
      category: 'Unknown',
      link: '',
      unit: 'kpl',
      unitPrice: 0,
      quantity
    };
  }

  const db = loadMaterials();
  const categoryInfo = db.categories[mat.category] || {};

  return {
    name: mat.name,
    category: categoryInfo.displayName || mat.category,
    link: mat.pricing?.link || '',
    unit: mat.pricing?.unit || 'kpl',
    unitPrice: mat.pricing?.unitPrice || 0,
    quantity
  };
}

/**
 * Generate BOM from scene objects with materials
 * @param {Object[]} sceneObjects - Array of scene objects with material refs
 * @returns {Object[]} BOM array compatible with existing materials export
 */
export function generateBOM(sceneObjects) {
  const quantities = new Map();

  for (const obj of sceneObjects) {
    if (!obj.material) continue;

    const matId = obj.material;
    const qty = obj.quantity || 1;

    quantities.set(matId, (quantities.get(matId) || 0) + qty);
  }

  const db = loadMaterials();
  const bom = [];

  // Sort by category order
  const sortedEntries = [...quantities.entries()].sort((a, b) => {
    const matA = db.materials[a[0]];
    const matB = db.materials[b[0]];
    const catA = db.categories[matA?.category]?.order || 999;
    const catB = db.categories[matB?.category]?.order || 999;
    return catA - catB;
  });

  for (const [matId, qty] of sortedEntries) {
    bom.push(bomEntry(matId, qty));
  }

  return bom;
}

/**
 * Material preset colors for common construction materials
 * Use these when you don't have a material database entry
 */
export const MaterialColors = {
  // Wood
  PINE: [0.85, 0.72, 0.52],
  PINE_TREATED: [0.45, 0.55, 0.38],
  PLYWOOD: [0.72, 0.62, 0.48],
  OSB: [0.78, 0.68, 0.48],

  // Metal
  GALVANIZED: [0.72, 0.72, 0.75],
  STEEL: [0.55, 0.55, 0.58],

  // Masonry
  CONCRETE: [0.55, 0.55, 0.52],
  BRICK_RED: [0.65, 0.32, 0.25],

  // Finishes
  PAINT_RED: [0.65, 0.22, 0.15],
  PAINT_WHITE: [0.95, 0.95, 0.92],

  // Insulation
  MINERAL_WOOL: [0.95, 0.92, 0.55],

  // Plastic
  VAPOR_BARRIER: [0.15, 0.15, 0.18],
};

/**
 * Quick helper to wrap geometry with a preset color
 * @param {Manifold} geometry - The geometry
 * @param {number[]} color - RGB array [0-1, 0-1, 0-1]
 * @returns {Object} Colored object for scene
 */
export function colored(geometry, color) {
  return { geometry, color };
}

// Export database for direct access
export { _materialsDb as database };

// Showroom - Multi-object scene with varied materials and shapes
// Demonstrates PBR materials, boolean ops, warp, revolve, and patterns

const S = 0.003;
export const displayScale = S;

const GOLD = [0.83, 0.69, 0.22];
const COPPER = [0.72, 0.45, 0.20];
const STEEL = [0.77, 0.78, 0.78];
const MARBLE = [0.92, 0.91, 0.88];
const OBSIDIAN = [0.05, 0.05, 0.07];

// --- Twisted column on pedestal (center piece) ---
const pedestalBase = cylinder({ height: 8, radius: 20, segments: 48 });
let col = cube({ size: [12, 12, 60], center: false });
col = translate(col, [-6, -6, 0]);
col = refineToLength(col, 5);
const twistedCol = warp(col, ([x, y, z]) => {
  const angle = (z / 60) * 135 * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c, z];
});
const column = union(pedestalBase, translate(twistedCol, [0, 0, 8]));
const topSphere = translate(sphere(9), [0, 0, 73]);

// --- Ring torus (standing upright) ---
const ring = translate(
  rotate(torus(14, 4), [90, 0, 0]),
  [80, -30, 18]
);

// --- Hollowed cube (sphere subtracted) ---
const outerCube = cube({ size: [28, 28, 28], center: true });
const hollowCube = difference(outerCube, sphere(15.5));
const cubeObj = translate(hollowCube, [-80, -30, 14]);

// --- Vase (revolve profile, hollowed) ---
const vaseProfile = [
  [0, 0], [12, 0], [14, 6], [9, 22], [8, 32],
  [12, 42], [13, 48], [12, 52], [0, 52]
];
const vaseOuter = revolve(vaseProfile, 36);
const vaseInner = translate(scale(revolve(vaseProfile, 36), [0.80, 0.80, 0.92]), [0, 0, 4]);
const vase = translate(difference(vaseOuter, vaseInner), [50, -80, 0]);

// --- Small bolt trio ---
const boltShaft = cylinder({ height: 18, radius: 2.5, segments: 12 });
const boltHead = translate(cylinder({ height: 4, radius: 5, segments: 6 }), [0, 0, 18]);
const bolt = union(boltShaft, boltHead);
const bolts = translate(linearPattern(bolt, 3, [14, 0, 0]), [-60, -80, 0]);

// --- Gem (octahedron from intersecting cubes) ---
const gemSize = 18;
const c1 = cube({ size: [gemSize, gemSize, gemSize], center: true });
const c2 = rotate(c1, [45, 0, 0]);
const c3 = rotate(c1, [0, 45, 0]);
const c4 = rotate(c1, [0, 0, 45]);
const gem = translate(intersection(intersection(c1, c2), intersection(c3, c4)), [0, -80, 13]);

export const scene = [
  withPBR(scale(column, S), { color: MARBLE, roughness: 0.25, metallic: 0.0 }),
  withPBR(scale(topSphere, S), { color: GOLD, roughness: 0.12, metallic: 0.95 }),
  withPBR(scale(ring, S), { color: GOLD, roughness: 0.18, metallic: 0.92 }),
  withPBR(scale(cubeObj, S), { color: STEEL, roughness: 0.35, metallic: 0.8 }),
  withPBR(scale(vase, S), { color: COPPER, roughness: 0.3, metallic: 0.85 }),
  withPBR(scale(bolts, S), { color: STEEL, roughness: 0.45, metallic: 0.7 }),
  withPBR(scale(gem, S), { color: OBSIDIAN, roughness: 0.05, metallic: 0.98 }),
];

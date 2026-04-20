// Desk Lamp - Helscoop multi-material PBR showcase
// Demonstrates cylinders, booleans, smooth(), and multiple PBR materials
// Coordinate convention: X=width, Y=depth, Z=height (up)

// @param base_r "Lamp" Base Radius (30-80)
const base_r = 50;
// @param stem_h "Lamp" Stem Height (80-200)
const stem_h = 140;
// @param shade_r "Lamp" Shade Radius (40-100)
const shade_r = 60;
// @param shade_h "Lamp" Shade Height (30-80)
const shade_h = 50;

const S = 0.004;
export const displayScale = S;

const BRASS = [0.78, 0.62, 0.28];
const CREAM = [0.95, 0.92, 0.85];

// --- Base (weighted disc) ---
const base = cylinder({ height: 10, radius: base_r, segments: 48 });

// --- Stem (tapered rod) ---
const stemR = 6;
const stem = translate(
  cylinder({ height: stem_h, radius: stemR, radiusTop: stemR * 0.75, segments: 16 }),
  [0, 0, 10]
);

// --- Socket ring (where shade meets stem) ---
const socketZ = 10 + stem_h - 6;
const socket = translate(
  cylinder({ height: 10, radius: stemR * 1.6, segments: 24 }),
  [0, 0, socketZ]
);

// --- Shade (conical, hollow) ---
const shadeZ = 10 + stem_h - shade_h * 0.6;
const shadeWall = 3;
const outerShade = translate(
  cylinder({ height: shade_h, radius: shade_r, radiusTop: shade_r * 0.3, segments: 48 }),
  [0, 0, shadeZ]
);
const innerShade = translate(
  cylinder({ height: shade_h + 2, radius: shade_r - shadeWall, radiusTop: shade_r * 0.3 - shadeWall, segments: 48 }),
  [0, 0, shadeZ - 1]
);
const shade = difference(outerShade, innerShade);

export const scene = [
  withPBR(scale(base, S), { color: BRASS, roughness: 0.25, metallic: 0.9 }),
  withPBR(scale(stem, S), { color: BRASS, roughness: 0.3, metallic: 0.85 }),
  withPBR(scale(socket, S), { color: BRASS, roughness: 0.35, metallic: 0.85 }),
  withPBR(scale(shade, S), { color: CREAM, roughness: 0.7, metallic: 0.0 }),
];

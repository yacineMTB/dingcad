// Badge / Keychain - Showcases hull2D, circle2D, offset2D, rect2D
// A rounded ID badge with cutout window and lanyard hole

// @param width "Badge" Width (40-120)
const width = 85;
// @param height "Badge" Height (50-140)
const height = 54;
// @param corner_radius "Badge" Corner Radius (3-15)
const corner_radius = 8;
// @param thickness "Badge" Thickness (2-6)
const thickness = 3;
// @param hole_radius "Badge" Lanyard Hole Radius (3-8)
const hole_radius = 4;

const S = 0.008;
export const displayScale = S;

function roundedRect(w, h, r) {
  const sharp = rect2D(w, h, true);
  return offset2D(offset2D(sharp, -r), r);
}

// Main badge body
const bodyProfile = roundedRect(width, height, corner_radius);
const body = extrude(bodyProfile, thickness);

// Photo/ID window cutout (left side)
const windowW = width * 0.35;
const windowH = height * 0.55;
const windowProfile = roundedRect(windowW, windowH, 3);
const windowCutout = translate(
  extrude(windowProfile, thickness + 2),
  [-width * 0.2, -height * 0.05, -1]
);

// Info line cutouts (right side text area, 3 horizontal slots)
const lineW = width * 0.3;
const lineH = 2;
const lineCutout = extrude(roundedRect(lineW, lineH, 0.8), thickness + 2);
const line1 = translate(lineCutout, [width * 0.15, height * 0.12, -1]);
const line2 = translate(lineCutout, [width * 0.15, 0, -1]);
const line3 = translate(lineCutout, [width * 0.15, -height * 0.12, -1]);

// Lanyard hole at top center
const holeCutout = translate(
  extrude(circle2D(hole_radius, 32), thickness + 2),
  [0, height * 0.38, -1]
);

// Reinforcement ring around lanyard hole (hull of two offset circles)
const innerRing = circle2D(hole_radius + 1.5, 32);
const outerRing = offset2D(innerRing, 2.5);
const ringProfile = hull2D(outerRing);
const ring = translate(
  extrude(ringProfile, thickness * 0.5),
  [0, height * 0.38, thickness]
);

// Chip contact pad (small gold rectangle on front)
const chipW = 10;
const chipH = 12;
const chipProfile = roundedRect(chipW, chipH, 1.5);
const chip = translate(
  extrude(chipProfile, 0.5),
  [-width * 0.2, height * 0.2, thickness]
);

// Build badge
const allCutouts = union(windowCutout, holeCutout, line1, line2, line3);
const badge = difference(union(body, ring), allCutouts);

const BADGE_COLOR = [0.88, 0.88, 0.90];
const CHIP_COLOR = [0.83, 0.69, 0.22];

export const scene = [
  withPBR(scale(badge, S), { color: BADGE_COLOR, roughness: 0.25, metallic: 0.3 }),
  withPBR(scale(chip, S), { color: CHIP_COLOR, roughness: 0.2, metallic: 0.9 }),
];

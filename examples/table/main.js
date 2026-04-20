// Parametric Table - Helscoop example
// Coordinate convention: X=width, Y=depth, Z=height (up)

// @param width "Table" Width (400-2000)
const width = 1200;
// @param depth "Table" Depth (300-1200)
const depth = 600;
// @param height "Table" Height (400-900)
const height = 750;
// @param top_thickness "Table" Top Thickness (15-50)
const top_thickness = 25;
// @param leg_size "Table" Leg Size (30-80)
const leg_size = 50;
// @param apron_height "Table" Apron Height (40-120)
const apron_height = 80;
// @param apron_thickness "Table" Apron Thickness (15-30)
const apron_thickness = 20;

const S = 0.003;
export const displayScale = S;

const OAK = [0.55, 0.35, 0.18];
const OAK_DARK = [0.45, 0.28, 0.14];

const leg_h = height - top_thickness;
const apron_z = leg_h - apron_height;
const inner_w = width - 2 * leg_size;
const inner_d = depth - 2 * leg_size;

// Tabletop: wide in X, deep in Y, thin in Z
const topPlaced = translate(cube([width, depth, top_thickness]),
  [-width/2, -depth/2, leg_h]);

// Four legs: thin in X/Y, tall in Z
const allLegs = union([
  translate(cube([leg_size, leg_size, leg_h]), [-width/2, -depth/2, 0]),
  translate(cube([leg_size, leg_size, leg_h]), [width/2 - leg_size, -depth/2, 0]),
  translate(cube([leg_size, leg_size, leg_h]), [-width/2, depth/2 - leg_size, 0]),
  translate(cube([leg_size, leg_size, leg_h]), [width/2 - leg_size, depth/2 - leg_size, 0]),
]);

// Aprons (cross-braces under tabletop between legs)
const allAprons = union([
  // Front and back aprons (wide in X, thin in Y, tall in Z)
  translate(cube([inner_w, apron_thickness, apron_height]),
    [-width/2 + leg_size, -depth/2 + (leg_size - apron_thickness)/2, apron_z]),
  translate(cube([inner_w, apron_thickness, apron_height]),
    [-width/2 + leg_size, depth/2 - leg_size + (leg_size - apron_thickness)/2, apron_z]),
  // Side aprons (thin in X, deep in Y, tall in Z)
  translate(cube([apron_thickness, inner_d, apron_height]),
    [-width/2 + (leg_size - apron_thickness)/2, -depth/2 + leg_size, apron_z]),
  translate(cube([apron_thickness, inner_d, apron_height]),
    [width/2 - leg_size + (leg_size - apron_thickness)/2, -depth/2 + leg_size, apron_z]),
]);

export const scene = [
  withPBR(scale(topPlaced, S), { color: OAK, roughness: 0.45, metallic: 0.0 }),
  withPBR(scale(allLegs, S), { color: OAK_DARK, roughness: 0.5, metallic: 0.0 }),
  withPBR(scale(allAprons, S), { color: OAK_DARK, roughness: 0.5, metallic: 0.0 }),
];

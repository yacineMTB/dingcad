// Turned Wooden Bowl - Helscoop revolve example
// Coordinate convention: X=width, Y=depth, Z=height (up)
// Revolve spins a 2D profile around the Y axis, then we rotate to Z-up

// @param outer_radius "Bowl" Outer Radius (40-150)
const outer_radius = 80;
// @param bowl_height "Bowl" Height (30-100)
const bowl_height = 60;
// @param wall_thickness "Bowl" Wall Thickness (3-12)
const wall_thickness = 5;
// @param foot_radius "Bowl" Foot Radius (15-60)
const foot_radius = 30;
// @param foot_height "Bowl" Foot Height (5-20)
const foot_height = 8;
// @param rim_flare "Bowl" Rim Flare (0-20)
const rim_flare = 8;

const S = 0.005;
export const displayScale = S;

const CHERRY = [0.55, 0.27, 0.15];

// Profile is defined in XY plane, revolved around Y axis
// X = radial distance, Y = height along revolution axis
// After revolving, we rotate 90° around X to stand the bowl upright (Y→Z)

const r = outer_radius;
const h = bowl_height;
const t = wall_thickness;
const fr = foot_radius;
const fh = foot_height;
const rf = rim_flare;

// Outer profile (bottom to top, going outward then back)
const outerProfile = [
  [0, 0],
  [fr, 0],
  [fr, fh],
  [fr + 2, fh],
  [r - 5, h * 0.3],
  [r, h * 0.7],
  [r + rf, h],
  [0, h],
];

// Inner profile (cavity)
const ir = r - t;
const innerProfile = [
  [0, fh + t],
  [fr - t, fh + t],
  [ir - 5, h * 0.35],
  [ir, h * 0.7],
  [ir + rf, h + 1],
  [0, h + 1],
];

const outerSolid = revolve([outerProfile], { segments: 64 });
const innerCavity = revolve([innerProfile], { segments: 64 });
const bowlRaw = difference(outerSolid, innerCavity);

// Smooth the surface subdivision and rotate upright (revolve Y → Z-up)
const bowl = rotate(smooth(bowlRaw, 0.5), [90, 0, 0]);

export const scene = [
  withPBR(scale(bowl, S), { color: CHERRY, roughness: 0.35, metallic: 0.0 }),
];

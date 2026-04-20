// Chess Pawn - Helscoop smooth() and hull() showcase
// Demonstrates organic shapes via smoothing low-poly primitives
// Coordinate convention: X=width, Y=depth, Z=height (up)

// @param base_r "Pawn" Base Radius (10-30)
const base_r = 18;
// @param height "Pawn" Total Height (40-100)
const height = 60;
// @param head_r "Pawn" Head Radius (5-15)
const head_r = 9;
// @param collar_r "Pawn" Collar Radius (8-20)
const collar_r = 13;

const S = 0.005;
export const displayScale = S;

const IVORY = [0.93, 0.89, 0.82];

// Base disc
const base = cylinder({ height: 5, radius: base_r, segments: 32 });

// Tapered body: stack of cylinders creates the profile
const body1 = translate(
  cylinder({ height: 8, radius: base_r * 0.9, radiusTop: base_r * 0.7, segments: 16 }),
  [0, 0, 5]
);
const body2 = translate(
  cylinder({ height: 20, radius: base_r * 0.7, radiusTop: collar_r * 0.7, segments: 16 }),
  [0, 0, 13]
);

// Collar ring
const collar = translate(
  cylinder({ height: 4, radius: collar_r, segments: 16 }),
  [0, 0, 33]
);

// Neck
const neck = translate(
  cylinder({ height: 8, radius: head_r * 0.6, segments: 12 }),
  [0, 0, 37]
);

// Head sphere
const headSphere = translate(sphere(head_r), [0, 0, height - head_r]);

// Combine all parts
let pawn = union(base, body1, body2, collar, neck, headSphere);

// Smooth the entire shape to create organic curves
pawn = smooth(pawn, 0.3);

export const scene = [
  withPBR(scale(pawn, S), { color: IVORY, roughness: 0.4, metallic: 0.05 }),
];

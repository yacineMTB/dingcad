// Open-End Wrench - Showcases hull2D, arc2D, slot2D, circle2D, offset2D
// A realistic parametric wrench using 2D operations and extrusion

// @param jaw_size "Wrench" Jaw Opening in mm (8-32)
const jaw_size = 17;
// @param length "Wrench" Handle Length (80-250)
const length = 180;
// @param thickness "Wrench" Thickness (3-8)
const thickness = 5;

const S = 0.005;
export const displayScale = S;

const jawR = jaw_size * 0.7;
const handleW = jaw_size * 0.55;
const headW = jaw_size * 1.3;

// Wrench head: arc shape with jaw opening
// Upper jaw arm
const upperJaw = arc2D(jawR, 30, 170, jaw_size * 0.32, 24);
// Lower jaw arm
const lowerJaw = arc2D(jawR, 190, 330, jaw_size * 0.32, 24);
// Combine jaw arcs into head profile using hull2D on each
const upperJawSolid = extrude(hull2D(upperJaw), thickness);
const lowerJawSolid = extrude(hull2D(lowerJaw), thickness);

// Head backing plate (fills behind the jaw)
const headBackPts = [
  [-headW * 0.5, -jawR * 0.6],
  [-headW * 0.5, jawR * 0.6],
  [-headW * 0.15, jawR * 0.9],
  [-headW * 0.15, -jawR * 0.9],
];
const headBack = extrude(hull2D(headBackPts), thickness);

// Handle: tapered slot shape
const handleProfile = slot2D(length, handleW, 16);
const handle = translate(
  extrude(handleProfile, thickness * 0.8),
  [-(length / 2 + headW * 0.15), 0, thickness * 0.1]
);

// Transition: hull between head and handle
const transitionPts = [
  [-headW * 0.4, -handleW * 0.5],
  [-headW * 0.4, handleW * 0.5],
  [-headW * 0.15, -jawR * 0.6],
  [-headW * 0.15, jawR * 0.6],
];
const transitionProfile = hull2D(transitionPts);
const transition = extrude(transitionProfile, thickness * 0.9);

// Stamp mark on handle (decorative groove)
const stampProfile = slot2D(jaw_size * 1.5, 2, 8);
const stampCutout = translate(
  extrude(stampProfile, thickness),
  [-(length * 0.3 + headW * 0.15), 0, thickness * 0.55]
);

// Assemble wrench
const wrenchBody = union(upperJawSolid, lowerJawSolid, headBack, handle, transition);
const wrench = difference(wrenchBody, stampCutout);

const CHROME = [0.82, 0.83, 0.84];

export const scene = [
  withPBR(scale(wrench, S), { color: CHROME, roughness: 0.15, metallic: 0.95 }),
];

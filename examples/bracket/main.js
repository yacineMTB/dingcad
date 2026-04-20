// Mounting Bracket - Showcases circle2D, rect2D, offset2D
// A steel L-bracket with rounded corners, bolt holes, and gussets

// @param width "Bracket" Width (40-200)
const width = 100;
// @param height "Bracket" Height (30-150)
const height = 70;
// @param depth "Bracket" Depth (30-150)
const depth = 60;
// @param thickness "Bracket" Plate Thickness (3-12)
const thickness = 5;
// @param corner_radius "Bracket" Corner Radius (2-15)
const corner_radius = 5;
// @param bolt_radius "Bracket" Bolt Hole Radius (3-8)
const bolt_radius = 4;

const S = 0.005;
export const displayScale = S;

const STEEL = [0.77, 0.78, 0.78];

// Rounded rectangle using offset2D double-offset trick
function roundedRect(w, h, r) {
  const sharp = rect2D(w, h, true);
  return offset2D(offset2D(sharp, -r), r);
}

// Base plate (horizontal, solid with bolt holes)
const baseProfile = roundedRect(width, depth, corner_radius);
const basePlate = extrude(baseProfile, thickness);

// Vertical plate (standing up from back edge, solid with bolt holes)
const vertProfile = roundedRect(width, height, corner_radius);
const vertPlate = translate(
  rotate(extrude(vertProfile, thickness), [90, 0, 0]),
  [0, depth / 2 - thickness, height / 2 + thickness]
);

// Gusset triangles for reinforcement
const gs = Math.min(depth * 0.5, height * 0.5);
const gussetProfile = [[[0, 0], [gs, 0], [0, gs]]];
const gussetThickness = thickness * 0.8;
const gussetBlock = extrude(gussetProfile, gussetThickness);
const gussetL = translate(
  rotate(gussetBlock, [0, -90, 0]),
  [-width / 2 + thickness + gussetThickness, depth / 2 - thickness - gs, thickness]
);
const gussetR = translate(
  rotate(gussetBlock, [0, -90, 0]),
  [width / 2 - thickness, depth / 2 - thickness - gs, thickness]
);

// Bolt holes through base plate
const boltHole = translate(extrude(circle2D(bolt_radius, 32), thickness * 3), [0, 0, -thickness]);
const baseBolt1 = translate(boltHole, [-width / 4, -depth / 6, 0]);
const baseBolt2 = translate(boltHole, [width / 4, -depth / 6, 0]);

// Bolt holes through vertical plate
const vertBolt = translate(rotate(boltHole, [90, 0, 0]), [0, 0, 0]);
const vertBolt1 = translate(vertBolt, [-width / 4, depth / 2, height / 2 + thickness]);
const vertBolt2 = translate(vertBolt, [width / 4, depth / 2, height / 2 + thickness]);

// Countersink on bolt holes (shallow wider circle)
const csink = translate(extrude(circle2D(bolt_radius * 1.6, 32), 1.5), [0, 0, -0.5]);
const cs1 = translate(csink, [-width / 4, -depth / 6, 0]);
const cs2 = translate(csink, [width / 4, -depth / 6, 0]);

const allHoles = union(union(baseBolt1, baseBolt2), union(vertBolt1, vertBolt2), union(cs1, cs2));

const bracket = difference(
  union(basePlate, vertPlate, gussetL, gussetR),
  allHoles
);

export const scene = [
  withPBR(scale(bracket, S), { color: STEEL, roughness: 0.35, metallic: 0.85 }),
];

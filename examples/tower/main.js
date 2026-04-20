// Twisted Tower - Demonstrates warp() for non-linear deformations
// A square column that twists as it rises

// @param height "Tower" Height (100-400)
const height = 250;
// @param width "Tower" Base Width (30-80)
const width = 50;
// @param twist "Tower" Twist Degrees (0-360)
const twist = 180;

const S = 0.003;
export const displayScale = S;

const CONCRETE = [0.75, 0.73, 0.70];
const GLASS = [0.6, 0.75, 0.85];

// Single tall box refined to have enough vertices for smooth warping
let tower = cube({size: [width, width, height], center: false});
tower = translate(tower, [-width/2, -width/2, 0]);
tower = refineToLength(tower, 12);

// Warp: twist around Z axis proportional to height
const towerTwisted = warp(tower, ([x, y, z]) => {
  const angle = (z / height) * twist * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos, z];
});

// Base platform
const base = cylinder({ height: 8, radius: width * 0.9, segments: 48 });

export const scene = [
  withPBR(scale(towerTwisted, S), { color: CONCRETE, roughness: 0.6, metallic: 0.0 }),
  withPBR(scale(base, S), { color: GLASS, roughness: 0.2, metallic: 0.5 }),
];

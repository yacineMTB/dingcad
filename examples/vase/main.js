// Parametric Vase - Helscoop extrude example

// @param radius "Vase" Base Radius (20-100)
const radius = 50;
// @param height "Vase" Height (50-300)
const height = 150;
// @param sides "Vase" Sides (3-12)
const sides = 12;
// @param wall_thickness "Vase" Wall Thickness (2-8)
const wall_thickness = 3;
// @param twist "Vase" Twist Degrees (0-180)
const twist = 45;
// @param top_scale "Vase" Top Scale (0.5-2.0)
const top_scale = 1.3;

const S = 0.005;
export const displayScale = S;

const CERAMIC = [0.85, 0.78, 0.72];

// Generate polygon points for a regular polygon
function polygon(r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return [pts];
}

// Outer shell
const outer = extrude(polygon(radius, sides), {
  height: height,
  twistDegrees: twist,
  scaleTop: top_scale,
  divisions: 32,
});

// Inner cavity (slightly smaller, slightly taller to open the top)
const inner = translate(
  extrude(polygon(radius - wall_thickness, sides), {
    height: height + 1,
    twistDegrees: twist,
    scaleTop: top_scale,
    divisions: 32,
  }),
  [0, 0, -0.5]
);

// Hollow vase = outer minus inner
const vase = difference(outer, inner);

export const scene = [
  withPBR(scale(vase, S), { color: CERAMIC, roughness: 0.15, metallic: 0.05 }),
];

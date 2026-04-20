// Parametric Spur Gear - Helscoop polygon extrusion example
// Coordinate convention: X=width, Y=depth, Z=height (up)

// @param num_teeth "Gear" Number of Teeth (8-40)
const num_teeth = 20;
// @param module_val "Gear" Module (3-15)
const module_val = 8;
// @param gear_width "Gear" Width (5-40)
const gear_width = 15;
// @param bore_radius "Gear" Bore Radius (3-30)
const bore_radius = 12;
// @param num_spokes "Gear" Spoke Holes (0-8)
const num_spokes = 6;
// @param spoke_radius "Gear" Spoke Hole Radius (5-25)
const spoke_radius = 15;

const S = 0.003;
export const displayScale = S;

const STEEL = [0.58, 0.57, 0.55];
const STEEL_DARK = [0.40, 0.39, 0.38];

function polar(r, angle) {
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

function gearProfile(m, z) {
  const pitch_r = m * z / 2;
  const outer_r = pitch_r + m;
  const root_r = pitch_r - 1.25 * m;

  const points = [];
  const tooth_angle = 2 * Math.PI / z;

  for (let i = 0; i < z; i++) {
    const a = i * tooth_angle;
    // Root arc
    points.push(polar(root_r, a - tooth_angle * 0.45));
    points.push(polar(root_r, a - tooth_angle * 0.25));
    // Rising flank
    points.push(polar(pitch_r, a - tooth_angle * 0.12));
    // Tooth tip
    points.push(polar(outer_r, a - tooth_angle * 0.06));
    points.push(polar(outer_r, a + tooth_angle * 0.06));
    // Falling flank
    points.push(polar(pitch_r, a + tooth_angle * 0.12));
    // Return to root
    points.push(polar(root_r, a + tooth_angle * 0.25));
    points.push(polar(root_r, a + tooth_angle * 0.45));
  }

  return [points];
}

const profile = gearProfile(module_val, num_teeth);
const gearBody = extrude(profile, { height: gear_width });

// Center bore
const bore = cylinder({ height: gear_width + 2, radius: bore_radius });
const boreCentered = translate(bore, [0, 0, -1]);

let gear = difference(gearBody, boreCentered);

// Lightening holes using circularPattern (rotates around Z axis)
const pitch_r = module_val * num_teeth / 2;
if (num_spokes > 0 && spoke_radius > 0) {
  const spokeR = (pitch_r - module_val * 1.25 + bore_radius) / 2;
  const spokeHole = translate(
    cylinder({ height: gear_width + 2, radius: spoke_radius }),
    [spokeR, 0, -1]
  );
  const allHoles = circularPattern(spokeHole, num_spokes);
  gear = difference(gear, allHoles);
}

export const scene = [withPBR(scale(gear, S), { color: STEEL, metallic: 0.9, roughness: 0.25 })];

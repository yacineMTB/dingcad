// Decorative Medallion - Showcases arc2D, star2D, ellipse2D, hull2D, offset2D
// A commemorative coin with star inlay, arc border details, and text-like grooves

// @param diameter "Medallion" Diameter (30-120)
const diameter = 80;
// @param thickness "Medallion" Thickness (2-8)
const thickness = 4;
// @param border_width "Medallion" Border Width (2-8)
const border_width = 4;

const S = 0.008;
export const displayScale = S;

const R = diameter / 2;

// Main disc body
const disc = extrude(circle2D(R, 64), thickness);

// Raised border ring
const outerRing = circle2D(R, 64);
const innerRing = offset2D(outerRing, -border_width);
const borderRing = difference(
  extrude(outerRing, thickness + 1.2),
  translate(extrude(innerRing, thickness + 2), [0, 0, -0.5])
);

// Central star (raised)
const starR = R * 0.35;
const starProfile = star2D(starR, starR * 0.42, 5);
const star = translate(extrude(starProfile, thickness + 0.8), [0, 0, 0]);

// Decorative arc segments around the border (12 evenly spaced tick marks)
const tickR = R - border_width - 1.5;
const tickWidth = 1.2;
const ticks = [];
for (let i = 0; i < 12; i++) {
  const startAngle = i * 30 - 3;
  const endAngle = i * 30 + 3;
  const tickArc = arc2D(tickR, startAngle, endAngle, tickWidth, 8);
  ticks.push(translate(extrude(tickArc, thickness + 0.6), [0, 0, 0]));
}
const allTicks = union(...ticks);

// Four decorative arc grooves (quarter-circle channels)
const grooveR = R * 0.58;
const grooveWidth = 1.5;
const grooves = [];
for (let i = 0; i < 4; i++) {
  const start = i * 90 + 15;
  const end = i * 90 + 75;
  const grooveArc = arc2D(grooveR, start, end, grooveWidth, 16);
  grooves.push(translate(extrude(grooveArc, thickness + 2), [0, 0, -0.5]));
}
const allGrooves = union(...grooves);

// Small dots between tick marks (using hull2D of tiny circles at positions)
const dots = [];
const dotR = R - border_width - 4;
for (let i = 0; i < 12; i++) {
  const angle = (i * 30 + 15) * Math.PI / 180;
  const x = dotR * Math.cos(angle);
  const y = dotR * Math.sin(angle);
  dots.push(translate(extrude(circle2D(0.8, 12), thickness + 0.5), [x, y, 0]));
}
const allDots = union(...dots);

// Inner elliptical border (decorative)
const innerEllipse = ellipse2D(R * 0.5, R * 0.48, 48);
const innerEllipseOuter = offset2D(innerEllipse, 0.8);
const ellipseRing = difference(
  translate(extrude(innerEllipseOuter, thickness + 0.4), [0, 0, 0]),
  translate(extrude(innerEllipse, thickness + 1), [0, 0, -0.3])
);

// Assemble medallion
const body = union(disc, borderRing, star, allTicks, allDots, ellipseRing);
const medallion = difference(body, allGrooves);

const GOLD = [0.83, 0.69, 0.22];

export const scene = [
  withPBR(scale(medallion, S), { color: GOLD, roughness: 0.25, metallic: 0.95 }),
];

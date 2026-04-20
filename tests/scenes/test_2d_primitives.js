// Test all 2D primitive functions: circle2D, rect2D, hull2D, offset2D,
// star2D, ellipse2D, slot2D, arc2D

const S = 0.1;
export const displayScale = S;

// Row 1: Basic shapes
const c = extrude(circle2D(5, 32), 2);
const r = translate(extrude(rect2D(8, 6), 2), [15, 0, 0]);
const e = translate(extrude(ellipse2D(6, 3, 32), 2), [30, 0, 0]);

// Row 2: Star, slot, arc
const st = translate(extrude(star2D(5, 2.5, 5), 2), [0, 15, 0]);
const sl = translate(extrude(slot2D(12, 4, 16), 2), [15, 15, 0]);
const ar = translate(extrude(arc2D(6, 0, 270, 1.5, 16), 2), [30, 15, 0]);

// Row 3: hull2D, offset2D
const pts = [[0,0], [8,0], [4,6]];
const h = translate(extrude(hull2D(pts), 2), [0, 30, 0]);
const base = circle2D(4, 24);
const off = translate(extrude(offset2D(base, 1.5), 2), [15, 30, 0]);
const offIn = translate(extrude(offset2D(base, -1.5), 2), [30, 30, 0]);

// Row 4: Combined operations
const starHull = hull2D(star2D(5, 2, 6));
const sh = translate(extrude(starHull, 2), [0, 45, 0]);
const arcSlot = hull2D(arc2D(5, 30, 150, 1, 12));
const as = translate(extrude(arcSlot, 2), [15, 45, 0]);

export const scene = [
  withColor(scale(c, S), [0.8, 0.2, 0.2]),
  withColor(scale(r, S), [0.2, 0.7, 0.2]),
  withColor(scale(e, S), [0.2, 0.3, 0.8]),
  withColor(scale(st, S), [0.9, 0.7, 0.1]),
  withColor(scale(sl, S), [0.7, 0.3, 0.7]),
  withColor(scale(ar, S), [0.3, 0.7, 0.7]),
  withColor(scale(h, S), [0.8, 0.5, 0.2]),
  withColor(scale(off, S), [0.4, 0.6, 0.3]),
  withColor(scale(offIn, S), [0.6, 0.3, 0.4]),
  withColor(scale(sh, S), [0.5, 0.5, 0.8]),
  withColor(scale(as, S), [0.8, 0.4, 0.5]),
];

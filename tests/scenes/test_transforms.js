// Test transform operations: translate, rotate, scale, mirror,
// linearPattern, circularPattern, warp, smooth, hull

const S = 0.05;
export const displayScale = S;

const base = cube({ size: [3, 3, 3], center: true });

// Translate
const t1 = translate(base, [0, 0, 0]);
// Rotate
const t2 = translate(rotate(base, [0, 0, 45]), [10, 0, 0]);
// Scale uniform
const t3 = translate(scale(base, 0.5), [20, 0, 0]);
// Scale non-uniform
const t4 = translate(scale(base, [2, 0.5, 1]), [30, 0, 0]);
// Mirror
const t5 = translate(mirror(base, [1, 0, 0]), [40, 0, 0]);

// LinearPattern
const lp = linearPattern(cube({ size: [1, 1, 4], center: true }), 5, [3, 0, 0]);
const t6 = translate(lp, [0, 15, 0]);

// CircularPattern
const cp = circularPattern(
  translate(cube({ size: [1, 1, 3], center: true }), [5, 0, 0]),
  8
);
const t7 = translate(cp, [20, 15, 0]);

// Hull of two shapes
const h = hull(
  translate(sphere(2), [0, 0, 0]),
  translate(sphere(1), [8, 0, 4])
);
const t8 = translate(h, [35, 15, 0]);

// Smooth
const sm = smooth(cube({ size: [5, 5, 5], center: true }));
const t9 = translate(sm, [0, 30, 0]);

// Warp (twist)
const warped = warp(
  cube({ size: [2, 2, 10], center: true }),
  ([x, y, z]) => {
    const angle = z * 0.3;
    return [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
      z
    ];
  }
);
const t10 = translate(warped, [15, 30, 5]);

// Boolean operations
const diff = difference(
  cube({ size: [6, 6, 6], center: true }),
  sphere(3.5)
);
const t11 = translate(diff, [30, 30, 3]);

const inter = intersection(
  cube({ size: [5, 5, 5], center: true }),
  sphere(3.5)
);
const t12 = translate(inter, [42, 30, 3]);

export const scene = [
  withColor(scale(t1, S), [0.8, 0.2, 0.2]),
  withColor(scale(t2, S), [0.2, 0.7, 0.2]),
  withColor(scale(t3, S), [0.2, 0.3, 0.8]),
  withColor(scale(t4, S), [0.9, 0.7, 0.1]),
  withColor(scale(t5, S), [0.7, 0.3, 0.7]),
  withColor(scale(t6, S), [0.3, 0.7, 0.7]),
  withColor(scale(t7, S), [0.8, 0.5, 0.2]),
  withColor(scale(t8, S), [0.4, 0.6, 0.3]),
  withColor(scale(t9, S), [0.6, 0.3, 0.4]),
  withColor(scale(t10, S), [0.5, 0.5, 0.8]),
  withColor(scale(t11, S), [0.8, 0.4, 0.5]),
  withColor(scale(t12, S), [0.3, 0.5, 0.7]),
];

// Test scene for color support

// Create some colored shapes
const redCube = withColor(
  cube({ size: [1, 1, 1], center: true }),
  [0.9, 0.2, 0.2]  // Red
);

const greenSphere = withColor(
  translate(sphere({ radius: 0.6 }), [2, 0, 0.6]),
  [0.2, 0.8, 0.3]  // Green
);

const blueCylinder = withColor(
  translate(cylinder({ height: 1.5, radius: 0.4 }), [-2, 0, 0]),
  [0.2, 0.4, 0.9]  // Blue
);

const yellowBox = withColor(
  translate(cube({ size: [0.8, 0.8, 0.8], center: false }), [0, 2, 0]),
  [0.95, 0.85, 0.1]  // Yellow
);

// Export as array of colored objects
export const scene = [redCube, greenSphere, blueCylinder, yellowBox];

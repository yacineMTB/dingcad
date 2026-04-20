// Test scene for Wall() primitive

// Create a simple wall along X-axis
const wall1 = Wall({
  start: [0, 0],
  end: [3000, 0],
  height: 2000,
  thickness: 98
});

// Create another wall along Y-axis
const wall2 = Wall({
  start: [0, 0],
  end: [0, 3000],
  height: 2000,
  thickness: 98
});

// Create a diagonal wall
const wall3 = Wall({
  start: [3000, 0],
  end: [3000, 3000],
  height: 2000,
  thickness: 98
});

// Create fourth wall to complete the square
const wall4 = Wall({
  start: [0, 3000],
  end: [3000, 3000],
  height: 2000,
  thickness: 98
});

// Scale down for viewing (mm to display units)
const DISPLAY_SCALE = 0.01;

// Color the walls
const coloredWall1 = withColor(scale(wall1, DISPLAY_SCALE), [0.7, 0.6, 0.4]);
const coloredWall2 = withColor(scale(wall2, DISPLAY_SCALE), [0.75, 0.65, 0.45]);
const coloredWall3 = withColor(scale(wall3, DISPLAY_SCALE), [0.7, 0.6, 0.4]);
const coloredWall4 = withColor(scale(wall4, DISPLAY_SCALE), [0.75, 0.65, 0.45]);

export const scene = [coloredWall1, coloredWall2, coloredWall3, coloredWall4];

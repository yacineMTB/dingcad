// Advanced test scene for Wall() primitive
// Demonstrates different wall configurations

const DISPLAY_SCALE = 0.01;

// Create a simple L-shaped building
const walls = [];

// Front wall (long)
walls.push(Wall({
  start: [0, 0],
  end: [6000, 0],
  height: 2400,
  thickness: 98
}));

// Left wall
walls.push(Wall({
  start: [0, 0],
  end: [0, 4000],
  height: 2400,
  thickness: 98
}));

// Back wall (short section)
walls.push(Wall({
  start: [0, 4000],
  end: [3000, 4000],
  height: 2400,
  thickness: 98
}));

// Interior wall (L-shape)
walls.push(Wall({
  start: [3000, 4000],
  end: [3000, 2000],
  height: 2400,
  thickness: 98
}));

// Interior wall continuation
walls.push(Wall({
  start: [3000, 2000],
  end: [6000, 2000],
  height: 2400,
  thickness: 98
}));

// Right wall
walls.push(Wall({
  start: [6000, 0],
  end: [6000, 2000],
  height: 2400,
  thickness: 98
}));

// Test different wall heights - a low wall (half height)
walls.push(Wall({
  start: [1500, 1000],
  end: [1500, 3000],
  height: 1200,  // Half height
  thickness: 98
}));

// Test different thickness - a thicker wall
walls.push(Wall({
  start: [4500, 500],
  end: [4500, 1500],
  height: 2400,
  thickness: 200  // Double thickness
}));

// Create colored walls with slight color variations
const WOOD_BASE = [0.72, 0.57, 0.38];
const coloredWalls = walls.map((wall, i) => {
  const variation = i * 0.02;
  const color = [
    Math.min(WOOD_BASE[0] + variation, 1.0),
    Math.min(WOOD_BASE[1] + variation, 1.0),
    Math.min(WOOD_BASE[2] + variation, 1.0)
  ];
  return withColor(scale(wall, DISPLAY_SCALE), color);
});

export const scene = coloredWalls;

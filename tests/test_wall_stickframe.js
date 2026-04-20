// Test scene for stick-frame Wall() construction
// Shows individual studs, plates, and optional sheathing

const DISPLAY_SCALE = 0.01;

// Create a stick-frame wall (without sheathing so we can see the studs)
const wall1 = Wall({
  start: [0, 0],
  end: [3000, 0],
  height: 2400,
  construction: "stickFrame",
  studSize: [48, 98],        // 2x4 studs (48mm x 98mm)
  studSpacing: 400,           // 400mm on center (16" OC)
  includeSheathing: false     // No sheathing - show the structure
});

// Create another wall with sheathing
const wall2 = Wall({
  start: [0, 0],
  end: [0, 2000],
  height: 2400,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: true,     // With sheathing
  sheathingThickness: 12      // 12mm OSB
});

// Create a wall with wider spacing (less studs)
const wall3 = Wall({
  start: [3000, 0],
  end: [3000, 2000],
  height: 2400,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 600,           // 600mm on center (24" OC)
  includeSheathing: false
});

// Create a wall with 2x6 studs (thicker for more insulation)
const wall4 = Wall({
  start: [0, 2000],
  end: [3000, 2000],
  height: 2400,
  construction: "stickFrame",
  studSize: [48, 148],        // 2x6 studs (48mm x 148mm)
  studSpacing: 400,
  includeSheathing: true,
  sheathingThickness: 12
});

// Color the walls
const WOOD_COLOR = [0.72, 0.57, 0.38];
const SHEATHING_COLOR = [0.85, 0.75, 0.60];

const coloredWall1 = withColor(scale(wall1, DISPLAY_SCALE), WOOD_COLOR);
const coloredWall2 = withColor(scale(wall2, DISPLAY_SCALE), SHEATHING_COLOR);
const coloredWall3 = withColor(scale(wall3, DISPLAY_SCALE), WOOD_COLOR);
const coloredWall4 = withColor(scale(wall4, DISPLAY_SCALE), SHEATHING_COLOR);

export const scene = [coloredWall1, coloredWall2, coloredWall3, coloredWall4];

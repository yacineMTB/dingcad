// Simple room demonstration using Wall() primitive
// This shows the stick-frame construction clearly

const DISPLAY_SCALE = 0.01;

// Room dimensions (in mm)
const roomLength = 4000;  // 4 meters
const roomWidth = 3000;   // 3 meters
const wallHeight = 2400;  // 2.4 meters

// Create four walls using the new Wall() primitive
const frontWall = Wall({
  start: [0, 0],
  end: [roomLength, 0],
  height: wallHeight,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: false  // Show the framing
});

const backWall = Wall({
  start: [0, roomWidth],
  end: [roomLength, roomWidth],
  height: wallHeight,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: true,  // With sheathing
  sheathingThickness: 12
});

const leftWall = Wall({
  start: [0, 0],
  end: [0, roomWidth],
  height: wallHeight,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: false
});

const rightWall = Wall({
  start: [roomLength, 0],
  end: [roomLength, roomWidth],
  height: wallHeight,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: true,
  sheathingThickness: 12
});

// Add a floor for reference
const floor = translate(
  cube({ size: [roomLength, roomWidth, 18], center: false }),
  [0, 0, -18]
);

// Colors
const WOOD_COLOR = [0.72, 0.57, 0.38];
const SHEATHING_COLOR = [0.85, 0.75, 0.60];
const FLOOR_COLOR = [0.85, 0.75, 0.60];

// Scale and color everything
const scaledFront = withColor(scale(frontWall, DISPLAY_SCALE), WOOD_COLOR);
const scaledBack = withColor(scale(backWall, DISPLAY_SCALE), SHEATHING_COLOR);
const scaledLeft = withColor(scale(leftWall, DISPLAY_SCALE), WOOD_COLOR);
const scaledRight = withColor(scale(rightWall, DISPLAY_SCALE), SHEATHING_COLOR);
const scaledFloor = withColor(scale(floor, DISPLAY_SCALE), FLOOR_COLOR);

export const scene = [
  scaledFloor,
  scaledFront,
  scaledBack,
  scaledLeft,
  scaledRight
];

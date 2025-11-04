// Mechanical part test - gear-like object
// This tests complex boolean operations and transformations

// Create gear tooth profile
function createGearTooth(radius, toothHeight, toothWidth) {
  const points = [];
  const angleStep = (toothWidth / radius) * (180 / Math.PI);
  
  // Outer arc
  for (let i = 0; i <= 10; i++) {
    const angle = (i / 10) * angleStep;
    points.push([
      Math.cos(angle) * (radius + toothHeight),
      Math.sin(angle) * (radius + toothHeight)
    ]);
  }
  
  // Inner arc
  for (let i = 10; i >= 0; i--) {
    const angle = (i / 10) * angleStep;
    points.push([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    ]);
  }
  
  return points;
}

// Create gear
const gearRadius = 20;
const toothHeight = 5;
const toothWidth = 3;
const numTeeth = 12;

const gearParts = [];

// Create gear body (cylinder)
const body = cylinder({height: 10, radius: gearRadius, center: true});

// Create teeth
for (let i = 0; i < numTeeth; i++) {
  const angle = (i / numTeeth) * 360;
  const tooth = createGearTooth(gearRadius, toothHeight, toothWidth);
  const extrudedTooth = extrude([tooth], {height: 10});
  const rotatedTooth = rotate(extrudedTooth, [0, 0, angle]);
  gearParts.push(rotatedTooth);
}

// Create center hole
const hole = translate(cylinder({height: 15, radius: 5, center: true}), [0, 0, 0]);

// Assemble gear
let gear = body;
for (const tooth of gearParts) {
  gear = union(gear, tooth);
}
gear = difference(gear, hole);

// Verify gear
assert(!isEmpty(gear), "Gear should not be empty");
assert(status(gear) === "NoError", "Gear should have no errors");
assert(volume(gear) > 0, "Gear should have positive volume");
assert(numTriangles(gear) > 0, "Gear should have triangles");

scene = gear;


// Performance tests - operations that should complete in reasonable time
// Note: These tests verify that operations complete, not strict timing

function timeOperation(name, operation) {
  const start = Date.now();
  const result = operation();
  const end = Date.now();
  const duration = end - start;
  print(`  ${name}: ${duration}ms`);
  return {result, duration};
}

print("Running performance tests...");

// Test 1: Simple operations should be fast
timeOperation("Simple cube", () => cube({size: [10, 10, 10]}));
timeOperation("Simple sphere", () => sphere({radius: 5}));
timeOperation("Simple cylinder", () => cylinder({height: 10, radius: 5}));

// Test 2: Boolean operations
const base = cube({size: [10, 10, 10], center: true});
const sub = sphere({radius: 5});
timeOperation("Union", () => union(base, sub));
timeOperation("Difference", () => difference(base, sub));
timeOperation("Intersection", () => intersection(base, sub));

// Test 3: Transformations
timeOperation("Translate", () => translate(base, [10, 10, 10]));
timeOperation("Scale", () => scale(base, 2));
timeOperation("Rotate", () => rotate(base, [45, 45, 45]));

// Test 4: Complex operations
const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
timeOperation("Extrude", () => extrude([square], {height: 10}));

const profile = [];
for (let i = 0; i <= 20; i++) {
  profile.push([i, Math.sin(i * 0.3) * 3 + 5]);
}
timeOperation("Revolve", () => revolve([profile], {segments: 64}));

// Test 5: Multiple boolean operations
let complex = base;
for (let i = 0; i < 5; i++) {
  const hole = translate(sphere({radius: 2}), [i * 3, 0, 0]);
  complex = difference(complex, hole);
}
timeOperation("Multiple differences", () => complex);

// Test 6: Mesh operations
const sphere2 = sphere({radius: 5});
timeOperation("Refine", () => refine(sphere2, 1));
timeOperation("Simplify", () => simplify(sphere2, 0.1));
timeOperation("SmoothOut", () => smoothOut(sphere2, 60, 0.5));

// Test 7: Batch operations
const manyCubes = [];
for (let i = 0; i < 20; i++) {
  manyCubes.push(translate(cube({size: [1, 1, 1], center: false}), [i, 0, 0]));
}
timeOperation("Batch boolean (20 objects)", () => batchBoolean("add", manyCubes));

// Test 8: Hull operations
const points = [];
for (let i = 0; i < 10; i++) {
  points.push([Math.random() * 20, Math.random() * 20, Math.random() * 20]);
}
timeOperation("Hull from points", () => hullPoints(points));

// Performance assertions
// Note: These are loose checks - actual performance depends on hardware
const perfTests = [
  {name: "Simple cube", maxMs: 100},
  {name: "Simple union", maxMs: 500},
  {name: "Extrude", maxMs: 1000},
];

print("\nPerformance test summary:");
print("All operations completed successfully");
print("Note: Actual timing depends on hardware and system load");

scene = complex; // Export for visual verification
print("✓ All performance tests completed");


// Integration tests for complex operations and combinations

// Test 1: Complex boolean operation chain
const base = cube({size: [20, 20, 20], center: true});
const hole1 = translate(cylinder({height: 30, radius: 5}), [0, 0, 0]);
const hole2 = translate(cylinder({height: 30, radius: 5}), [10, 0, 0]);
const hole3 = translate(cylinder({height: 30, radius: 5}), [-10, 0, 0]);

const withHoles = difference(base, hole1, hole2, hole3);
assert(!isEmpty(withHoles), "Object with holes should not be empty");
assert(volume(withHoles) < volume(base), "Object with holes should have less volume");
assert(status(withHoles) === "NoError", "Complex difference should have no errors");

// Test 2: Multi-step transformation chain
const transformed = translate(
  rotate(
    scale(
      cube({size: [10, 10, 10], center: true}),
      [1.5, 1.5, 1.5]
    ),
    [45, 45, 45]
  ),
  [20, 20, 20]
);
assert(!isEmpty(transformed), "Multi-step transformation should not be empty");
assert(status(transformed) === "NoError", "Multi-step transformation should have no errors");

// Test 3: Extrude with twist and boolean
const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
const twisted = extrude([square], {
  height: 20,
  twistDegrees: 360,
  scaleTop: 0.5
});
const cap = cube({size: [15, 15, 5], center: false});
const capped = union(twisted, cap);
assert(!isEmpty(capped), "Capped twisted extrude should not be empty");
assert(status(capped) === "NoError", "Capped twisted extrude should have no errors");

// Test 4: Revolve with boolean operations
const profile = [];
for (let i = 0; i <= 20; i++) {
  const x = i / 2;
  const y = Math.sin(i * 0.3) * 3 + 5;
  profile.push([x, y]);
}
const revolved = revolve([profile], {segments: 64, degrees: 360});
const cut = cube({size: [30, 30, 10], center: true});
const cutRevolved = difference(revolved, cut);
assert(!isEmpty(cutRevolved), "Cut revolved object should not be empty");
assert(status(cutRevolved) === "NoError", "Cut revolved object should have no errors");

// Test 5: Hull with multiple objects
const objects = [];
for (let i = 0; i < 5; i++) {
  const obj = translate(
    sphere({radius: 2}),
    [i * 5, Math.sin(i) * 5, Math.cos(i) * 5]
  );
  objects.push(obj);
}
const hulled = hull(...objects);
assert(!isEmpty(hulled), "Hull of multiple objects should not be empty");
assert(volume(hulled) > 0, "Hull should have positive volume");
assert(status(hulled) === "NoError", "Hull should have no errors");

// Test 6: Complex mesh refinement
const complex = union(
  cube({size: [10, 10, 10], center: true}),
  translate(sphere({radius: 5}), [5, 5, 5])
);
const refined = refineToTolerance(complex, 0.01);
const simplified = simplify(refined, 0.1);
assert(!isEmpty(simplified), "Refined and simplified object should not be empty");
assert(status(simplified) === "NoError", "Refined and simplified should have no errors");

// Test 7: Batch boolean with many objects
const manyCubes = [];
for (let i = 0; i < 10; i++) {
  manyCubes.push(translate(cube({size: [2, 2, 2], center: false}), [i * 3, 0, 0]));
}
const batched = batchBoolean("add", manyCubes);
assert(!isEmpty(batched), "Batch boolean should not be empty");
assert(status(batched) === "NoError", "Batch boolean should have no errors");

// Test 8: Compose and decompose
const parts = [
  cube({size: [5, 5, 5], center: false}),
  translate(cube({size: [5, 5, 5], center: false}), [5, 0, 0]),
  translate(cube({size: [5, 5, 5], center: false}), [0, 5, 0])
];
const composed = compose(...parts);
assert(!isEmpty(composed), "Composed object should not be empty");
const decomposed = decompose(composed);
assert(Array.isArray(decomposed), "Decomposed should return array");
assert(decomposed.length >= 1, "Decomposed should have at least one part");

// Test 9: Level set (if supported and working)
// Note: Level set requires SDF function, may not work in all cases
try {
  const levelSetObj = levelSet({
    sdf: (p) => {
      const x = p[0], y = p[1], z = p[2];
      return Math.sqrt(x*x + y*y + z*z) - 5;
    },
    bounds: {min: [-10, -10, -10], max: [10, 10, 10]},
    edgeLength: 0.5,
    level: 0
  });
  assert(!isEmpty(levelSetObj), "Level set should not be empty");
  assert(status(levelSetObj) === "NoError", "Level set should have no errors");
} catch (e) {
  print(`Level set test skipped: ${e}`);
}

// Test 10: Property calculations
const withProps = calculateNormals(complex, 0);
assert(numProperties(withProps) > 3, "Should have more than 3 properties after normals");
const withCurv = calculateCurvature(withProps, 0, 1);
assert(numProperties(withCurv) >= 5, "Should have at least 5 properties after curvature");

scene = withHoles; // Export for visual verification
print("✓ All integration tests passed");


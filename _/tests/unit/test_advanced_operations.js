// Test advanced operations (extrude, revolve, hull, etc.)

// Test extrude
const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
const extruded = extrude([square], {height: 5});
assert(!isEmpty(extruded), "Extruded object should not be empty");
assert(volume(extruded) > 0, "Extruded object should have positive volume");

// Test extrude with options
const extruded2 = extrude([square], {
  height: 10,
  divisions: 2,
  twistDegrees: 90,
  scaleTop: 0.5
});
assert(!isEmpty(extruded2), "Extruded with options should not be empty");

// Test revolve
const halfCircle = [];
for (let i = 0; i <= 10; i++) {
  const angle = (i / 10) * Math.PI;
  halfCircle.push([Math.cos(angle) * 5, Math.sin(angle) * 5]);
}
const revolved = revolve([halfCircle], {segments: 32, degrees: 360});
assert(!isEmpty(revolved), "Revolved object should not be empty");
assert(volume(revolved) > 0, "Revolved object should have positive volume");

// Test hull
const cube1 = cube({size: [5, 5, 5], center: false});
const cube2 = translate(cube1, [10, 0, 0]);
const cube3 = translate(cube1, [5, 10, 0]);
const hull1 = hull(cube1, cube2, cube3);
assert(!isEmpty(hull1), "Hull should not be empty");
assert(volume(hull1) >= volume(cube1), "Hull volume should be >= any component");

// Test hullPoints
const points = [
  [0, 0, 0],
  [10, 0, 0],
  [5, 10, 0],
  [5, 5, 10]
];
const hull2 = hullPoints(points);
assert(!isEmpty(hull2), "Hull from points should not be empty");
assert(numVertices(hull2) > 0, "Hull from points should have vertices");

// Test slice
const cylinder = cylinder({height: 10, radius: 5});
const sliceResult = slice(cylinder, 5);
assert(Array.isArray(sliceResult), "Slice should return array of polygons");
assert(sliceResult.length > 0, "Slice should return at least one polygon");

// Test project
const projected = project(cylinder);
assert(Array.isArray(projected), "Project should return array of polygons");
assert(projected.length > 0, "Project should return at least one polygon");

// Test compose
const part1 = cube({size: [5, 5, 5], center: false});
const part2 = translate(cube({size: [5, 5, 5], center: false}), [5, 0, 0]);
const composed = compose(part1, part2);
assert(!isEmpty(composed), "Composed object should not be empty");
assert(numTriangles(composed) === numTriangles(part1) + numTriangles(part2),
       "Composed object should have sum of component triangles");

// Test decompose
const complex = union(part1, part2);
const decomposed = decompose(complex);
assert(Array.isArray(decomposed), "Decompose should return array");
assert(decomposed.length >= 1, "Decompose should return at least one component");

// Test trimByPlane
const trimmed = trimByPlane(cylinder, [0, 1, 0], 5);
assert(!isEmpty(trimmed), "Trimmed object should not be empty");

scene = hull1; // Export for visual verification
print("✓ All advanced operation tests passed");


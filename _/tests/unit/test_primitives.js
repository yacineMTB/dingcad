// Test basic geometric primitives
// These tests verify that all primitive shapes can be created correctly

// Test cube creation
const cube1 = cube({size: [10, 10, 10], center: false});
assert(!isEmpty(cube1), "Cube should not be empty");
assert(numTriangles(cube1) > 0, "Cube should have triangles");
assert(numVertices(cube1) > 0, "Cube should have vertices");
assert(volume(cube1) > 0, "Cube should have positive volume");
assert(surfaceArea(cube1) > 0, "Cube should have positive surface area");

const cube2 = cube({size: [5, 5, 5], center: true});
assert(!isEmpty(cube2), "Centered cube should not be empty");

// Test sphere creation
const sphere1 = sphere({radius: 5});
assert(!isEmpty(sphere1), "Sphere should not be empty");
assert(numTriangles(sphere1) > 0, "Sphere should have triangles");
assert(volume(sphere1) > 0, "Sphere should have positive volume");

// Verify sphere volume is approximately correct (4/3 * π * r³)
const expectedVolume = (4/3) * Math.PI * Math.pow(5, 3);
const actualVolume = volume(sphere1);
const volumeError = Math.abs(actualVolume - expectedVolume) / expectedVolume;
assert(volumeError < 0.1, `Sphere volume should be close to expected (error: ${volumeError})`);

// Test cylinder creation
const cylinder1 = cylinder({height: 10, radius: 5});
assert(!isEmpty(cylinder1), "Cylinder should not be empty");
assert(numTriangles(cylinder1) > 0, "Cylinder should have triangles");
assert(volume(cylinder1) > 0, "Cylinder should have positive volume");

const cylinder2 = cylinder({height: 10, radius: 5, radiusTop: 3, center: true});
assert(!isEmpty(cylinder2), "Tapered cylinder should not be empty");

// Test tetrahedron
const tetra = tetrahedron();
assert(!isEmpty(tetra), "Tetrahedron should not be empty");
assert(numTriangles(tetra) === 4, "Tetrahedron should have 4 triangles");
assert(numVertices(tetra) === 4, "Tetrahedron should have 4 vertices");

// Test bounding boxes
const bbox1 = boundingBox(cube1);
assert(bbox1.min.length === 3, "Bounding box min should have 3 components");
assert(bbox1.max.length === 3, "Bounding box max should have 3 components");
assert(bbox1.max[0] > bbox1.min[0], "Bounding box max should be greater than min");

scene = cube1; // Export for visual verification
print("✓ All primitive tests passed");


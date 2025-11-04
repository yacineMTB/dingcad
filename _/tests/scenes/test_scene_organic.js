// Organic/artistic shape test
// Tests hull operations, smooth surfaces, and freeform shapes

// Create organic shape using hull of multiple spheres
const spheres = [];
const numSpheres = 8;

for (let i = 0; i < numSpheres; i++) {
  const angle = (i / numSpheres) * Math.PI * 2;
  const radius = 15 + Math.sin(i * 2) * 5;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const z = Math.cos(i * 0.5) * 10;
  
  const sphereObj = translate(
    sphere({radius: 3 + Math.random() * 2}),
    [x, y, z]
  );
  spheres.push(sphereObj);
}

// Create hull
let organic = hull(...spheres);

// Smooth the surface
organic = smoothOut(organic, 60, 0.3);

// Add some refinement
organic = refineToTolerance(organic, 0.5);

// Verify organic shape
assert(!isEmpty(organic), "Organic shape should not be empty");
assert(status(organic) === "NoError", "Organic shape should have no errors");
assert(volume(organic) > 0, "Organic shape should have positive volume");
assert(numTriangles(organic) > 0, "Organic shape should have triangles");

// Calculate properties
const bbox = boundingBox(organic);
assert(bbox.min.length === 3 && bbox.max.length === 3, "Should have valid bounding box");
assert(bbox.max[0] > bbox.min[0], "Bounding box should be valid");

scene = organic;


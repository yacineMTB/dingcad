// Test mesh operations (simplify, refine, smooth, etc.)

// Create base object
const base = sphere({radius: 5});
const baseTriangles = numTriangles(base);
const baseVertices = numVertices(base);

// Test simplify
const simplified = simplify(base, 0.1);
assert(!isEmpty(simplified), "Simplified object should not be empty");
assert(volume(simplified) > 0, "Simplified object should have positive volume");
// Simplification may reduce or keep triangle count depending on tolerance

// Test refine
const refined1 = refine(base, 1);
assert(!isEmpty(refined1), "Refined object should not be empty");
assert(numTriangles(refined1) > baseTriangles, 
       "Refined object should have more triangles");

// Test refineToLength
const refined2 = refineToLength(base, 0.5);
assert(!isEmpty(refined2), "Refined to length object should not be empty");
assert(numTriangles(refined2) > baseTriangles,
       "Refined to length should increase triangle count");

// Test refineToTolerance
const refined3 = refineToTolerance(base, 0.001);
assert(!isEmpty(refined3), "Refined to tolerance object should not be empty");

// Test calculateNormals
const withNormals = calculateNormals(base, 0);
assert(!isEmpty(withNormals), "Object with normals should not be empty");
assert(numProperties(withNormals) > 0, "Should have properties after calculating normals");

// Test calculateCurvature
const withCurvature = calculateCurvature(base, 0, 1);
assert(!isEmpty(withCurvature), "Object with curvature should not be empty");
assert(numProperties(withCurvature) >= 2, "Should have at least 2 properties for curvature");

// Test smoothByNormals
const smoothed1 = smoothByNormals(base, 0);
assert(!isEmpty(smoothed1), "Smoothed object should not be empty");
assert(volume(smoothed1) > 0, "Smoothed object should have positive volume");

// Test smoothOut
const smoothed2 = smoothOut(base, 60, 0.5);
assert(!isEmpty(smoothed2), "SmoothOut object should not be empty");
assert(volume(smoothed2) > 0, "SmoothOut object should have positive volume");

// Test properties
const numProps = numProperties(base);
assert(numProps >= 3, "Base object should have at least 3 properties (x, y, z)");

const numPropVerts = numPropertyVertices(base);
assert(numPropVerts >= numVertices(base), 
       "Property vertices should be >= regular vertices");

// Test asOriginal
const original = asOriginal(base);
assert(!isEmpty(original), "AsOriginal should not be empty");

// Test originalId
const origId = originalId(base);
assert(typeof origId === 'number', "OriginalId should return a number");
assert(origId >= 0, "OriginalId should be non-negative");

// Test reserveIds
const reservedBase = reserveIds(10);
assert(typeof reservedBase === 'number', "ReserveIds should return a number");

// Test genus (for closed surfaces)
const sphereGenus = genus(base);
assert(sphereGenus === 0, "Sphere should have genus 0");

// Test edge count
const edges = numEdges(base);
assert(edges > 0, "Object should have edges");
// For a valid mesh: edges ≈ (3 * triangles) / 2 (approximately)
const expectedEdges = (3 * baseTriangles) / 2;
assert(Math.abs(edges - expectedEdges) < expectedEdges * 0.5, 
       "Edge count should be approximately correct");

scene = smoothed1; // Export for visual verification
print("✓ All mesh operation tests passed");


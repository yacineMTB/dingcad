// Test geometric transformations

// Create base object
const base = cube({size: [10, 10, 10], center: true});
const baseVolume = volume(base);
const baseBBox = boundingBox(base);

// Test translation
const translated = translate(base, [20, 30, 40]);
assert(!isEmpty(translated), "Translated object should not be empty");
assert(volume(translated) === baseVolume, "Translation should not change volume");

const translatedBBox = boundingBox(translated);
assert(Math.abs(translatedBBox.min[0] - baseBBox.min[0] - 20) < 0.1, 
       "Translation should move bounding box");
assert(Math.abs(translatedBBox.min[1] - baseBBox.min[1] - 30) < 0.1, 
       "Translation should move bounding box");
assert(Math.abs(translatedBBox.min[2] - baseBBox.min[2] - 40) < 0.1, 
       "Translation should move bounding box");

// Test scale (uniform)
const scaled1 = scale(base, 2.0);
assert(!isEmpty(scaled1), "Scaled object should not be empty");
assert(Math.abs(volume(scaled1) - baseVolume * 8) < 0.1, 
       "Uniform scale by 2 should multiply volume by 8");

// Test scale (non-uniform)
const scaled2 = scale(base, [2, 1, 1]);
assert(!isEmpty(scaled2), "Non-uniform scaled object should not be empty");
assert(Math.abs(volume(scaled2) - baseVolume * 2) < 0.1, 
       "Non-uniform scale should multiply volume correctly");

// Test rotation (90 degrees around Z axis)
const rotated = rotate(base, [0, 0, 90]);
assert(!isEmpty(rotated), "Rotated object should not be empty");
assert(Math.abs(volume(rotated) - baseVolume) < 0.1, 
       "Rotation should not change volume");

// Test mirror
const mirrored = mirror(base, [1, 0, 0]);
assert(!isEmpty(mirrored), "Mirrored object should not be empty");
assert(Math.abs(volume(mirrored) - baseVolume) < 0.1, 
       "Mirror should not change volume");

// Test transform (identity matrix)
const identityMatrix = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0
];
const transformed1 = transform(base, identityMatrix);
assert(!isEmpty(transformed1), "Identity transformed object should not be empty");
assert(Math.abs(volume(transformed1) - baseVolume) < 0.1, 
       "Identity transform should not change volume");

// Test combined transformations
const combined = translate(rotate(scale(base, 1.5), [45, 45, 45]), [10, 10, 10]);
assert(!isEmpty(combined), "Combined transformations should not be empty");
assert(volume(combined) > baseVolume, "Scaled and transformed object should have larger volume");

// Test tolerance
const tolerance1 = getTolerance(base);
assert(tolerance1 >= 0, "Tolerance should be non-negative");

const setTol = setTolerance(base, 0.001);
assert(!isEmpty(setTol), "Set tolerance should not be empty");
const tolerance2 = getTolerance(setTol);
assert(Math.abs(tolerance2 - 0.001) < 0.0001, "Set tolerance should match");

scene = combined; // Export for visual verification
print("✓ All transformation tests passed");


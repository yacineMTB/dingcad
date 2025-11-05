// Test boolean operations (union, difference, intersection)

// Create test objects
const base = cube({size: [10, 10, 10], center: true});
const subtract = sphere({radius: 5});
const subtractTranslated = translate(subtract, [0, 0, 0]);

// Test union
const union1 = union(base, subtractTranslated);
assert(!isEmpty(union1), "Union should not be empty");
assert(volume(union1) > volume(base), "Union volume should be >= base volume");

// Test difference
const diff1 = difference(base, subtractTranslated);
assert(!isEmpty(diff1), "Difference should not be empty");
assert(volume(diff1) < volume(base), "Difference volume should be < base volume");

// Test intersection
const intersect1 = intersection(base, subtractTranslated);
assert(!isEmpty(intersect1), "Intersection should not be empty");
assert(volume(intersect1) <= Math.min(volume(base), volume(subtractTranslated)), 
       "Intersection volume should be <= min of operands");

// Test boolean function with string op
const union2 = boolean(base, subtractTranslated, "add");
assert(!isEmpty(union2), "Boolean add should not be empty");

const diff2 = boolean(base, subtractTranslated, "subtract");
assert(!isEmpty(diff2), "Boolean subtract should not be empty");

const intersect2 = boolean(base, subtractTranslated, "intersect");
assert(!isEmpty(intersect2), "Boolean intersect should not be empty");

// Test batch boolean operations
const batch1 = batchBoolean("add", [base, subtractTranslated]);
assert(!isEmpty(batch1), "Batch boolean add should not be empty");

const batch2 = batchBoolean("subtract", [base, subtractTranslated]);
assert(!isEmpty(batch2), "Batch boolean subtract should not be empty");

const batch3 = batchBoolean("intersect", [base, subtractTranslated]);
assert(!isEmpty(batch3), "Batch boolean intersect should not be empty");

// Test multiple unions
const cube1 = cube({size: [5, 5, 5], center: false});
const cube2 = translate(cube1, [3, 0, 0]);
const cube3 = translate(cube1, [6, 0, 0]);
const multiUnion = union(cube1, cube2, cube3);
assert(!isEmpty(multiUnion), "Multiple union should not be empty");
assert(numTriangles(multiUnion) > numTriangles(cube1), 
       "Multiple union should have more triangles");

// Test status checking
const status1 = status(union1);
assert(status1 === "NoError", `Union status should be NoError, got: ${status1}`);

scene = union1; // Export for visual verification
print("✓ All boolean operation tests passed");


// Basic scene test - simple geometric assembly
// This tests that the scene can be created and exported

const base = cube({size: [20, 20, 5], center: true});
const pillar1 = translate(cylinder({height: 10, radius: 3}), [-7, -7, 2.5]);
const pillar2 = translate(cylinder({height: 10, radius: 3}), [7, -7, 2.5]);
const pillar3 = translate(cylinder({height: 10, radius: 3}), [-7, 7, 2.5]);
const pillar4 = translate(cylinder({height: 10, radius: 3}), [7, 7, 2.5]);

const assembly = union(base, pillar1, pillar2, pillar3, pillar4);

// Verify assembly
assert(!isEmpty(assembly), "Assembly should not be empty");
assert(status(assembly) === "NoError", "Assembly should have no errors");
assert(volume(assembly) > 0, "Assembly should have positive volume");

scene = assembly;


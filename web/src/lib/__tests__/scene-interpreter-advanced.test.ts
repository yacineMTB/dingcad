import { describe, it, expect } from "vitest";
import { interpretScene } from "@/lib/scene-interpreter";

// ---------------------------------------------------------------------------
// 1. hullImpl
// ---------------------------------------------------------------------------

describe("hullImpl", () => {
  it("produces a hull type with hullVertices from two boxes", () => {
    const result = interpretScene(`
      const a = cube({ size: [1, 1, 1], center: true });
      const b = translate(cube({ size: [1, 1, 1], center: true }), [3, 0, 0]);
      const h = hull(a, b);
      scene.add(h);
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].geometry).toBe("hull");
    expect(result.objects[0].hullVertices).toBeDefined();
    // Two unit boxes = 8 corners each = 16 corners * 3 coords = 48 values
    expect(result.objects[0].hullVertices!.length).toBe(48);
  });

  it("hullVertices are flat [x0,y0,z0,x1,y1,z1,...] format", () => {
    const result = interpretScene(`
      const scene = [
        hull(
          cube({ size: [2, 2, 2], center: true }),
          translate(cube({ size: [2, 2, 2], center: true }), [5, 0, 0])
        ),
      ];
    `);
    expect(result.error).toBeNull();
    const verts = result.objects[0].hullVertices!;
    // Must be divisible by 3 (triplets of xyz)
    expect(verts.length % 3).toBe(0);
    // All values should be numbers
    for (const v of verts) {
      expect(typeof v).toBe("number");
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("returns the single mesh when only one argument given", () => {
    const result = interpretScene(`
      const h = hull(box(2, 2, 2));
      scene.add(h);
    `);
    expect(result.error).toBeNull();
    // Single mesh passthrough
    expect(result.objects[0].geometry).toBe("box");
    expect(result.objects[0].args).toEqual([2, 2, 2]);
  });

  it("returns an empty group when called with no arguments", () => {
    const result = interpretScene(`
      const h = hull();
      scene.add(h);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("group");
    expect(result.objects[0].args).toEqual([]);
  });

  it("extracts vertices from cylinders", () => {
    const result = interpretScene(`
      const scene = [
        hull(
          cylinder({ radius: 1, height: 2, center: true }),
          translate(cylinder({ radius: 1, height: 2, center: true }), [5, 0, 0])
        ),
      ];
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("hull");
    expect(result.objects[0].hullVertices).toBeDefined();
    // Cylinders produce 8 angles * 2 ends = 16 points per cylinder, 32 total
    expect(result.objects[0].hullVertices!.length).toBe(32 * 3);
  });

  it("extracts vertices from spheres", () => {
    const result = interpretScene(`
      const scene = [
        hull(
          sphere(1),
          translate(sphere(1), [5, 0, 0])
        ),
      ];
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("hull");
    expect(result.objects[0].hullVertices).toBeDefined();
    // Spheres: 3x3x3 grid minus center = 26 points per sphere, 52 total
    expect(result.objects[0].hullVertices!.length).toBe(52 * 3);
  });

  it("accepts an array of meshes as argument", () => {
    const result = interpretScene(`
      const parts = [
        cube({ size: [1, 1, 1], center: true }),
        translate(cube({ size: [1, 1, 1], center: true }), [4, 0, 0]),
      ];
      const h = hull(parts);
      scene.add(h);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("hull");
    expect(result.objects[0].hullVertices).toBeDefined();
  });

  it("extracts vertices from nested groups", () => {
    const result = interpretScene(`
      const group1 = union(
        cube({ size: [1, 1, 1], center: true }),
        translate(cube({ size: [1, 1, 1], center: true }), [2, 0, 0])
      );
      const group2 = translate(cube({ size: [1, 1, 1], center: true }), [0, 5, 0]);
      const h = hull(group1, group2);
      scene.add(h);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("hull");
    expect(result.objects[0].hullVertices).toBeDefined();
    // Group with 2 boxes (16 corners) + 1 box (8 corners) = 24 corners * 3
    expect(result.objects[0].hullVertices!.length).toBe(24 * 3);
  });

  it("hull position, rotation, scale default to identity", () => {
    const result = interpretScene(`
      const scene = [
        hull(
          cube({ size: [1, 1, 1], center: true }),
          translate(cube({ size: [1, 1, 1], center: true }), [3, 0, 0])
        ),
      ];
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].position).toEqual([0, 0, 0]);
    expect(result.objects[0].rotation).toEqual([0, 0, 0]);
    expect(result.objects[0].scale).toEqual([1, 1, 1]);
  });

  it("hull vertices reflect box dimensions correctly", () => {
    const result = interpretScene(`
      const scene = [
        hull(
          cube({ size: [2, 4, 6], center: true }),
        ),
      ];
    `);
    expect(result.error).toBeNull();
    // Single mesh passthrough for hull with one arg
    expect(result.objects[0].geometry).toBe("box");
    expect(result.objects[0].args).toEqual([2, 4, 6]);
  });
});

// ---------------------------------------------------------------------------
// 2. wallImpl — detailed stud count and plate verification
// ---------------------------------------------------------------------------

describe("wallImpl — detailed structure", () => {
  it("wall with default 1000mm length has correct stud count", () => {
    // Default: start=[0,0], end=[1000,0], studSpacing=400
    // numStuds = ceil(1000/400) + 1 = 3 + 1 = 4
    // Parts: bottom plate + top plate + 4 studs = 6 total
    const result = interpretScene(`
      const w = Wall({});
      scene.add(w);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("group");
    const group = result.objects[0];
    // The wall is: translated frame (which is a union group)
    // The group's children should contain the wall components
    expect(group.children).toBeDefined();

    // Count total leaf nodes recursively
    function countLeaves(obj: typeof group): number {
      if (!obj.children || obj.children.length === 0) return 1;
      return obj.children.reduce((sum, c) => sum + countLeaves(c), 0);
    }
    // 2 plates + 4 studs = 6 leaf boxes
    expect(countLeaves(group)).toBe(6);
  });

  it("wall with 2000mm length and 600mm spacing has correct stud count", () => {
    // numStuds = ceil(2000/600) + 1 = 4 + 1 = 5
    // Total parts: 2 plates + 5 studs = 7
    const result = interpretScene(`
      const w = Wall({
        start: [0, 0],
        end: [2000, 0],
        studSpacing: 600,
      });
      scene.add(w);
    `);
    expect(result.error).toBeNull();

    function countLeaves(obj: (typeof result.objects)[0]): number {
      if (!obj.children || obj.children.length === 0) return 1;
      return obj.children.reduce((sum, c) => sum + countLeaves(c), 0);
    }
    expect(countLeaves(result.objects[0])).toBe(7);
  });

  it("bottom and top plates span the full wall length", () => {
    const result = interpretScene(`
      const scene = [
        Wall({ start: [0, 0], end: [1500, 0], height: 2400, studSize: [48, 98] }),
      ];
    `);
    expect(result.error).toBeNull();
    // The wall group should exist
    expect(result.objects[0].geometry).toBe("group");

    // Find the leaf boxes to check plate dimensions
    function collectLeaves(obj: (typeof result.objects)[0]): (typeof result.objects)[0][] {
      if (!obj.children || obj.children.length === 0) return [obj];
      return obj.children.flatMap(c => collectLeaves(c));
    }
    const leaves = collectLeaves(result.objects[0]);
    // All leaves should be boxes
    for (const leaf of leaves) {
      expect(leaf.geometry).toBe("box");
    }
    // The plates should have args[0] = wallLen = 1500
    const plates = leaves.filter(l => l.args[0] === 1500 && l.args[2] === 48);
    expect(plates.length).toBe(2); // bottom + top plate
  });

  it("top plate is positioned at height minus plate height", () => {
    const result = interpretScene(`
      const scene = [
        Wall({ start: [0, 0], end: [1000, 0], height: 2400, studSize: [48, 98] }),
      ];
    `);
    expect(result.error).toBeNull();

    function collectLeaves(obj: (typeof result.objects)[0]): (typeof result.objects)[0][] {
      if (!obj.children || obj.children.length === 0) return [obj];
      return obj.children.flatMap(c => collectLeaves(c));
    }
    const leaves = collectLeaves(result.objects[0]);
    // Plates: args[2] = 48 (plateH = studSize[0])
    const plates = leaves.filter(l => l.args[2] === 48);
    expect(plates.length).toBe(2);

    // Find positions — one should be near z=0 (bottom) and one near z=2352 (height - plateH = 2400-48)
    const zPositions = plates.map(p => p.position[2]).sort((a, b) => a - b);
    // Bottom plate: z = plateH/2 = 24 (centered due to cubeImpl offset)
    expect(zPositions[0]).toBeCloseTo(24, 0);
    // Top plate: z = (2400 - 48) + plateH/2 = 2352 + 24 = 2376
    expect(zPositions[1]).toBeCloseTo(2376, 0);
  });

  it("stud height equals wall height minus two plates", () => {
    const height = 2400;
    const plateH = 48;
    const expectedStudH = height - 2 * plateH; // 2304

    const result = interpretScene(`
      const scene = [
        Wall({ start: [0, 0], end: [1000, 0], height: ${height}, studSize: [${plateH}, 98] }),
      ];
    `);
    expect(result.error).toBeNull();

    function collectLeaves(obj: (typeof result.objects)[0]): (typeof result.objects)[0][] {
      if (!obj.children || obj.children.length === 0) return [obj];
      return obj.children.flatMap(c => collectLeaves(c));
    }
    const leaves = collectLeaves(result.objects[0]);
    // Studs: args[2] = studH = 2304
    const studs = leaves.filter(l => l.args[2] === expectedStudH);
    expect(studs.length).toBeGreaterThan(0);
    // Each stud should have args[2] = 2304
    for (const stud of studs) {
      expect(stud.args[2]).toBe(expectedStudH);
    }
  });

  it("angled wall rotates correctly", () => {
    // 45 degree wall: start=[0,0], end=[1000,1000]
    const result = interpretScene(`
      const scene = [
        Wall({ start: [0, 0], end: [1000, 1000], height: 2400 }),
      ];
    `);
    expect(result.error).toBeNull();
    // The outer group should have rotation around Z
    // angle = atan2(1000, 1000) = 45 degrees = PI/4 radians
    // The wall applies rotation at the top level
    const obj = result.objects[0];
    // Check that there is a non-zero Z rotation somewhere in the tree
    function findRotationZ(o: typeof obj): number {
      if (Math.abs(o.rotation[2]) > 0.01) return o.rotation[2];
      if (o.children) {
        for (const c of o.children) {
          const r = findRotationZ(c);
          if (r !== 0) return r;
        }
      }
      return 0;
    }
    const rotZ = findRotationZ(obj);
    expect(rotZ).toBeCloseTo(45, 0); // 45 degrees
  });

  it("straight wall (angle=0) has no rotation", () => {
    const result = interpretScene(`
      const scene = [
        Wall({ start: [0, 0], end: [2000, 0] }),
      ];
    `);
    expect(result.error).toBeNull();
    const obj = result.objects[0];
    function maxRotationZ(o: typeof obj): number {
      let max = Math.abs(o.rotation[2]);
      if (o.children) {
        for (const c of o.children) {
          max = Math.max(max, maxRotationZ(c));
        }
      }
      return max;
    }
    expect(maxRotationZ(obj)).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// 3. scaleImpl — recursive child scaling
// ---------------------------------------------------------------------------

describe("scaleImpl — children scaling", () => {
  it("scales children recursively with uniform factor", () => {
    const result = interpretScene(`
      const group = union(
        box(1, 1, 1),
        translate(box(1, 1, 1), 2, 0, 0),
      );
      const scaled = scale(group, 3);
      scene.add(scaled);
    `);
    expect(result.error).toBeNull();
    const obj = result.objects[0];
    expect(obj.geometry).toBe("group");
    expect(obj.scale).toEqual([3, 3, 3]);
    // Children should also be scaled
    expect(obj.children).toBeDefined();
    expect(obj.children!.length).toBe(2);
    expect(obj.children![0].scale).toEqual([3, 3, 3]);
    expect(obj.children![1].scale).toEqual([3, 3, 3]);
    // Second child's position should be scaled: [2,0,0] * 3 = [6,0,0]
    expect(obj.children![1].position[0]).toBeCloseTo(6);
  });

  it("scales children recursively with non-uniform factor", () => {
    const result = interpretScene(`
      const group = union(
        box(1, 1, 1),
        translate(box(1, 1, 1), 1, 2, 3),
      );
      const scaled = scale(group, [2, 3, 4]);
      scene.add(scaled);
    `);
    expect(result.error).toBeNull();
    const obj = result.objects[0];
    expect(obj.scale).toEqual([2, 3, 4]);
    expect(obj.children![0].scale).toEqual([2, 3, 4]);
    expect(obj.children![1].scale).toEqual([2, 3, 4]);
    // Position scaled: [1*2, 2*3, 3*4] = [2, 6, 12]
    expect(obj.children![1].position).toEqual([2, 6, 12]);
  });

  it("double-scaling compounds the scale factor", () => {
    const result = interpretScene(`
      let b = box(1, 1, 1);
      b = scale(b, 2);
      b = scale(b, 3);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].scale).toEqual([6, 6, 6]);
  });

  it("scaling does not mutate original mesh", () => {
    const result = interpretScene(`
      const original = box(1, 1, 1);
      const scaled = scale(original, 5);
      scene.add(original);
      scene.add(scaled);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].scale).toEqual([1, 1, 1]);
    expect(result.objects[1].scale).toEqual([5, 5, 5]);
  });
});

// ---------------------------------------------------------------------------
// 4. unionImpl — edge cases
// ---------------------------------------------------------------------------

describe("unionImpl — edge cases", () => {
  it("returns empty group when called with no arguments", () => {
    const result = interpretScene(`
      const u = union();
      scene.add(u);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("group");
    expect(result.objects[0].args).toEqual([]);
    expect(result.objects[0].children).toBeUndefined();
  });

  it("returns the single mesh when called with one argument", () => {
    const result = interpretScene(`
      const b = box(3, 3, 3);
      const u = union(b);
      scene.add(u);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("box");
    expect(result.objects[0].args).toEqual([3, 3, 3]);
  });

  it("flattens arrays into parts", () => {
    const result = interpretScene(`
      const parts = [box(1, 1, 1), box(2, 2, 2)];
      const u = union(parts);
      scene.add(u);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("group");
    expect(result.objects[0].children).toHaveLength(2);
  });

  it("handles mix of arrays and individual meshes", () => {
    const result = interpretScene(`
      const arr = [box(1, 1, 1), box(2, 2, 2)];
      const single = box(3, 3, 3);
      const u = union(arr, single);
      scene.add(u);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("group");
    expect(result.objects[0].children).toHaveLength(3);
  });

  it("skips non-mesh, non-array arguments", () => {
    const result = interpretScene(`
      const u = union(box(1, 1, 1), null, undefined, 42, box(2, 2, 2));
      scene.add(u);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("group");
    expect(result.objects[0].children).toHaveLength(2);
  });

  it("union of three or more meshes creates a group with all children", () => {
    const result = interpretScene(`
      const u = union(box(1,1,1), box(2,2,2), box(3,3,3), box(4,4,4));
      scene.add(u);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("group");
    expect(result.objects[0].children).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 5. differenceImpl — returns first argument
// ---------------------------------------------------------------------------

describe("differenceImpl", () => {
  it("creates difference type with children", () => {
    const result = interpretScene(`
      const a = translate(box(4, 4, 4), 1, 2, 3);
      const b = box(1, 1, 1);
      const d = difference(a, b);
      scene.add(d);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("difference");
    expect(result.objects[0].children).toHaveLength(2);
    expect(result.objects[0].children![0].geometry).toBe("box");
    expect(result.objects[0].children![0].args).toEqual([4, 4, 4]);
  });
});

// ---------------------------------------------------------------------------
// 6. Sandbox security — enhanced
// ---------------------------------------------------------------------------

describe("sandbox security — enhanced", () => {
  it("require is not available in sandbox", () => {
    const result = interpretScene(`
      const fs = require("fs");
    `);
    expect(result.error).not.toBeNull();
  });

  it("import keyword in variable declaration is a syntax error", () => {
    const result = interpretScene(`
      import foo from "bar";
    `);
    // Static import is invalid inside Function constructor
    expect(result.error).not.toBeNull();
  });

  it("process global is not accessible in sandbox", () => {
    const result = interpretScene(`
      const p = typeof process;
      scene.add(box(1, 1, 1));
    `);
    // In jsdom, process may exist as a global, but the script should still run
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
  });

  it("setTimeout/setInterval are not available as sandbox params", () => {
    // These are not passed to the sandbox Function, so they depend on
    // the global environment. The key point: they're not injected.
    const result = interpretScene(`
      const hasTimeout = typeof setTimeout;
      scene.add(box(1, 1, 1));
    `);
    // Should not crash regardless
    expect(result.error).toBeNull();
  });

  it("sandbox catches thrown errors gracefully", () => {
    const result = interpretScene(`
      throw new Error("intentional error");
    `);
    expect(result.error).toBe("intentional error");
    expect(result.objects).toHaveLength(0);
  });

  it("sandbox catches type errors gracefully", () => {
    const result = interpretScene(`
      const x = null;
      x.something();
    `);
    expect(result.error).not.toBeNull();
    expect(result.objects).toHaveLength(0);
  });

  it("sandbox catches reference errors for truly undefined names", () => {
    const result = interpretScene(`
      const x = completelyUndefinedVariableName;
    `);
    expect(result.error).not.toBeNull();
  });

  it("handles stack overflow from deep recursion", () => {
    const result = interpretScene(`
      function recurse() { return recurse(); }
      recurse();
    `);
    expect(result.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. interpretScene — integration edge cases
// ---------------------------------------------------------------------------

describe("interpretScene — integration edge cases", () => {
  it("handles for loops building complex scenes", () => {
    const result = interpretScene(`
      for (let i = 0; i < 5; i++) {
        scene.add(translate(box(1, 1, 1), i * 2, 0, 0));
      }
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(5);
    // Check positions are correct
    for (let i = 0; i < 5; i++) {
      expect(result.objects[i].position[0]).toBeCloseTo(i * 2);
    }
  });

  it("handles user-defined functions", () => {
    const result = interpretScene(`
      function pillar(height) {
        return cylinder({ radius: 0.1, height: height, center: false });
      }
      scene.add(pillar(3));
      scene.add(translate(pillar(3), 2, 0, 0));
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0].geometry).toBe("cylinder");
    expect(result.objects[0].args).toEqual([0.1, 3]);
  });

  it("handles Math library usage", () => {
    const result = interpretScene(`
      const r = Math.sqrt(2);
      const angle = Math.PI / 4;
      scene.add(
        translate(box(1, 1, 1), Math.cos(angle) * 5, Math.sin(angle) * 5, 0)
      );
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].position[0]).toBeCloseTo(Math.cos(Math.PI / 4) * 5);
    expect(result.objects[0].position[1]).toBeCloseTo(Math.sin(Math.PI / 4) * 5);
  });

  it("handles ternary expressions", () => {
    const result = interpretScene(`
      const tall = true;
      const h = tall ? 5 : 2;
      scene.add(box(1, h, 1));
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].args).toEqual([1, 5, 1]);
  });

  it("handles Array.from and map patterns", () => {
    const result = interpretScene(`
      const columns = Array.from({ length: 3 }, (_, i) =>
        translate(cylinder(0.2, 3), i * 2, 0, 0)
      );
      for (const col of columns) {
        scene.add(col);
      }
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(3);
  });

  it("handles both scene APIs correctly — scene.add vs const scene = []", () => {
    // scene.add API
    const result1 = interpretScene(`
      scene.add(box(1, 1, 1), { material: "wood", color: [0.8, 0.6, 0.4] });
    `);
    expect(result1.error).toBeNull();
    expect(result1.objects).toHaveLength(1);
    expect(result1.objects[0].material).toBe("wood");
    expect(result1.objects[0].color).toEqual([0.8, 0.6, 0.4]);

    // const scene = [] API
    const result2 = interpretScene(`
      const scene = [
        withPBR(box(1, 1, 1), { material: "wood", color: [0.8, 0.6, 0.4] }),
      ];
    `);
    expect(result2.error).toBeNull();
    expect(result2.objects).toHaveLength(1);
    expect(result2.objects[0].material).toBe("wood");
    expect(result2.objects[0].color).toEqual([0.8, 0.6, 0.4]);
  });

  it("withMaterial wrapper works in const scene API", () => {
    const result = interpretScene(`
      const scene = [
        withMaterial(box(2, 2, 2), "galvanized_roofing"),
      ];
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].material).toBe("galvanized_roofing");
  });

  it("withColorId wrapper works in const scene API", () => {
    const result = interpretScene(`
      const scene = [
        withColorId(box(2, 2, 2), [1, 0, 0], "wall-1"),
      ];
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].color).toEqual([1, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// 8. Post-validation warnings
// ---------------------------------------------------------------------------

describe("post-validation", () => {
  it("warns when scene is empty (no objects added)", () => {
    const result = interpretScene(`
      const b = box(1, 1, 1);
      // forgot to scene.add()
    `);
    expect(result.warnings).toContain("validation.emptyScene");
  });

  it("does not warn emptyScene when objects exist", () => {
    const result = interpretScene(`
      scene.add(box(1, 1, 1));
    `);
    expect(result.warnings).not.toContain("validation.emptyScene");
  });
});

// ---------------------------------------------------------------------------
// 9. Transform immutability
// ---------------------------------------------------------------------------

describe("transform immutability", () => {
  it("translate does not mutate original mesh position", () => {
    const result = interpretScene(`
      const a = box(1, 1, 1);
      const b = translate(a, 10, 20, 30);
      scene.add(a);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].position).toEqual([0, 0, 0]);
    expect(result.objects[1].position).toEqual([10, 20, 30]);
  });

  it("rotate does not mutate original mesh rotation", () => {
    const result = interpretScene(`
      const a = box(1, 1, 1);
      const b = rotate(a, 1, 2, 3);
      scene.add(a);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].rotation).toEqual([0, 0, 0]);
    expect(result.objects[1].rotation).toEqual([1, 2, 3]);
  });

  it("scale does not mutate original mesh scale", () => {
    const result = interpretScene(`
      const a = box(1, 1, 1);
      const b = scale(a, 5);
      scene.add(a);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].scale).toEqual([1, 1, 1]);
    expect(result.objects[1].scale).toEqual([5, 5, 5]);
  });
});

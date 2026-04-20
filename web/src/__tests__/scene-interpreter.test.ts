import { describe, it, expect } from "vitest";
import { interpretScene } from "@/lib/scene-interpreter";
import type { SceneObject } from "@/lib/scene-interpreter";

describe("interpretScene", () => {
  it("creates a box with default material and color", () => {
    const result = interpretScene(`
      const b = box(2, 3, 4);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].geometry).toBe("box");
    expect(result.objects[0].args).toEqual([2, 3, 4]);
    expect(result.objects[0].material).toBe("default");
    expect(result.objects[0].color).toEqual([0.8, 0.8, 0.8]);
  });

  it("creates a cylinder", () => {
    const result = interpretScene(`
      const c = cylinder(1.5, 3);
      scene.add(c, { material: "pipe", color: [0.5, 0.5, 0.5] });
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].geometry).toBe("cylinder");
    expect(result.objects[0].args).toEqual([1.5, 3]);
    expect(result.objects[0].material).toBe("pipe");
    expect(result.objects[0].color).toEqual([0.5, 0.5, 0.5]);
  });

  it("creates a sphere", () => {
    const result = interpretScene(`
      scene.add(sphere(2), { material: "stone" });
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].geometry).toBe("sphere");
    expect(result.objects[0].args).toEqual([2]);
  });

  it("translates a mesh", () => {
    const result = interpretScene(`
      const b = translate(box(1, 1, 1), 3, 4, 5);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].position).toEqual([3, 4, 5]);
  });

  it("accumulates translations", () => {
    const result = interpretScene(`
      let b = box(1, 1, 1);
      b = translate(b, 1, 0, 0);
      b = translate(b, 0, 2, 0);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].position).toEqual([1, 2, 0]);
  });

  it("rotates a mesh", () => {
    const result = interpretScene(`
      const b = rotate(box(1, 1, 1), 0.5, 0, 0);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].rotation).toEqual([0.5, 0, 0]);
  });

  it("accumulates rotations", () => {
    const result = interpretScene(`
      let b = box(1, 1, 1);
      b = rotate(b, 0.1, 0, 0);
      b = rotate(b, 0, 0.2, 0);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].rotation[0]).toBeCloseTo(0.1);
    expect(result.objects[0].rotation[1]).toBeCloseTo(0.2);
    expect(result.objects[0].rotation[2]).toBeCloseTo(0);
  });

  it("combines translate and rotate", () => {
    const result = interpretScene(`
      let b = box(2, 2, 2);
      b = translate(b, 1, 2, 3);
      b = rotate(b, 0, 0.5, 0);
      scene.add(b);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].position).toEqual([1, 2, 3]);
    expect(result.objects[0].rotation).toEqual([0, 0.5, 0]);
  });

  it("creates union groups with children", () => {
    const result = interpretScene(`
      const a = box(1, 1, 1);
      const b = translate(box(1, 1, 1), 2, 0, 0);
      const u = union(a, b);
      scene.add(u, { material: "lumber" });
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].geometry).toBe("group");
    expect(result.objects[0].children).toHaveLength(2);
    expect(result.objects[0].children![0].geometry).toBe("box");
    expect(result.objects[0].children![1].position).toEqual([2, 0, 0]);
  });

  it("subtract creates difference type with children", () => {
    const result = interpretScene(`
      const wall = box(4, 3, 0.15);
      const door = translate(box(1, 2, 0.15), 0, 1, 0);
      const wallWithDoor = subtract(wall, door);
      scene.add(wallWithDoor, { material: "lumber" });
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("difference");
    expect(result.objects[0].children).toHaveLength(2);
    expect(result.objects[0].children![0].geometry).toBe("box");
    expect(result.objects[0].children![0].args).toEqual([4, 3, 0.15]);
  });

  it("intersect creates intersection type with children", () => {
    const result = interpretScene(`
      const a = box(2, 2, 2);
      const b = translate(box(2, 2, 2), 1, 0, 0);
      scene.add(intersect(a, b));
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].geometry).toBe("intersection");
    expect(result.objects[0].children).toHaveLength(2);
    expect(result.objects[0].children![0].geometry).toBe("box");
    expect(result.objects[0].children![0].args).toEqual([2, 2, 2]);
  });

  it("handles multiple scene.add calls", () => {
    const result = interpretScene(`
      scene.add(box(6, 0.2, 4), { material: "foundation", color: [0.7, 0.7, 0.7] });
      scene.add(translate(box(6, 2.8, 0.15), 0, 1.5, -1.925), { material: "lumber", color: [0.85, 0.75, 0.55] });
      scene.add(translate(box(6, 2.8, 0.15), 0, 1.5, 1.925), { material: "lumber", color: [0.85, 0.75, 0.55] });
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(3);
    expect(result.objects[0].material).toBe("foundation");
    expect(result.objects[1].material).toBe("lumber");
    expect(result.objects[2].material).toBe("lumber");
  });

  it("handles the default scene script", () => {
    const result = interpretScene(`
      const floor = box(6, 0.2, 4);
      const wall1 = translate(box(6, 2.8, 0.15), 0, 1.5, -1.925);
      const wall2 = translate(box(6, 2.8, 0.15), 0, 1.5, 1.925);
      const wall3 = translate(box(0.15, 2.8, 4), -2.925, 1.5, 0);
      const wall4 = translate(box(0.15, 2.8, 4), 2.925, 1.5, 0);
      scene.add(floor, { material: "foundation", color: [0.7, 0.7, 0.7] });
      scene.add(wall1, { material: "lumber", color: [0.85, 0.75, 0.55] });
      scene.add(wall2, { material: "lumber", color: [0.85, 0.75, 0.55] });
      scene.add(wall3, { material: "lumber", color: [0.85, 0.75, 0.55] });
      scene.add(wall4, { material: "lumber", color: [0.85, 0.75, 0.55] });
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(5);
  });

  it("returns error for invalid JavaScript", () => {
    const result = interpretScene(`
      this is not valid javascript!!!
    `);
    expect(result.error).not.toBeNull();
    expect(result.objects).toHaveLength(0);
  });

  it("cube is a valid alias for box — no error", () => {
    const result = interpretScene(`
      const b = cube(1, 1, 1);
      scene.add(b);
    `);
    // cube is mapped to cubeImpl, same as box
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].geometry).toBe("box");
  });

  it("handles empty script", () => {
    const result = interpretScene("");
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(0);
  });

  it("handles script with only comments", () => {
    const result = interpretScene(`
      // This is a comment
      /* Multi-line
         comment */
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(0);
  });

  it("preserves position on original mesh after translate", () => {
    const result = interpretScene(`
      const original = box(1, 1, 1);
      const moved = translate(original, 5, 0, 0);
      scene.add(original);
      scene.add(moved);
    `);
    expect(result.error).toBeNull();
    expect(result.objects[0].position).toEqual([0, 0, 0]);
    expect(result.objects[1].position).toEqual([5, 0, 0]);
  });

  it("handles pihasauna template scene script", () => {
    const result = interpretScene(`
      const floor = box(4, 0.2, 3);
      const wall1 = translate(box(4, 2.4, 0.12), 0, 1.3, -1.44);
      const wall2 = translate(box(4, 2.4, 0.12), 0, 1.3, 1.44);
      const wall3 = translate(box(0.12, 2.4, 3), -1.94, 1.3, 0);
      const wall4 = translate(box(0.12, 2.4, 3), 1.94, 1.3, 0);
      const door = translate(box(0.8, 2.0, 0.12), 1.0, 1.1, -1.44);
      const wall1_cut = subtract(wall1, door);
      const roof1 = translate(rotate(box(2.3, 0.05, 4.4), 0, 0, 0.52), -1.0, 2.9, 0);
      const roof2 = translate(rotate(box(2.3, 0.05, 4.4), 0, 0, -0.52), 1.0, 2.9, 0);
      scene.add(floor, { material: "foundation", color: [0.65, 0.65, 0.65] });
      scene.add(wall1_cut, { material: "lumber", color: [0.82, 0.68, 0.47] });
      scene.add(wall2, { material: "lumber", color: [0.82, 0.68, 0.47] });
      scene.add(wall3, { material: "lumber", color: [0.82, 0.68, 0.47] });
      scene.add(wall4, { material: "lumber", color: [0.82, 0.68, 0.47] });
      scene.add(roof1, { material: "roofing", color: [0.35, 0.32, 0.30] });
      scene.add(roof2, { material: "roofing", color: [0.35, 0.32, 0.30] });
    `);
    expect(result.error).toBeNull();
    expect(result.objects).toHaveLength(7);
    const materials = result.objects.map((o) => o.material);
    expect(materials).toContain("foundation");
    expect(materials).toContain("lumber");
    expect(materials).toContain("roofing");
  });
});

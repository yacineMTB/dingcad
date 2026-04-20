import { describe, it, expect } from "vitest";
import { parseSceneParams, applyParamToScript } from "@/lib/scene-interpreter";
import type { SceneParam } from "@/lib/scene-interpreter";

describe("parseSceneParams", () => {
  it("parses a single @param annotation", () => {
    const script = `// @param height "Dimensions" Height (100-5000)
const height = 2400;
scene.add(box(6000, height, 200));`;
    const params = parseSceneParams(script);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("height");
    expect(params[0].section).toBe("Dimensions");
    expect(params[0].label).toBe("Height");
    expect(params[0].min).toBe(100);
    expect(params[0].max).toBe(5000);
    expect(params[0].value).toBe(2400);
  });

  it("parses multiple @param annotations from different sections", () => {
    const script = `// @param width "Dimensions" Width (1000-10000)
const width = 6000;
// @param height "Dimensions" Height (100-5000)
const height = 2400;
// @param roofAngle "Roof" Angle (15-45)
const roofAngle = 30;`;
    const params = parseSceneParams(script);
    expect(params).toHaveLength(3);
    expect(params[0].name).toBe("width");
    expect(params[1].name).toBe("height");
    expect(params[2].name).toBe("roofAngle");
    expect(params[2].section).toBe("Roof");
  });

  it("returns empty array for script without @param annotations", () => {
    const script = `const height = 2400;
scene.add(box(6000, height, 200));`;
    expect(parseSceneParams(script)).toHaveLength(0);
  });

  it("returns empty array for empty script", () => {
    expect(parseSceneParams("")).toHaveLength(0);
  });

  it("uses min as default value when variable declaration is missing", () => {
    const script = `// @param height "Dimensions" Height (100-5000)`;
    const params = parseSceneParams(script);
    expect(params).toHaveLength(1);
    expect(params[0].value).toBe(100);
  });

  it("computes step based on range size", () => {
    // range <= 1 -> step 1
    const smallRange = parseSceneParams(`// @param opacity "Style" Opacity (0-1)\nconst opacity = 0.5;`);
    expect(smallRange[0].step).toBe(1);

    // range <= 100 -> step 1
    const medRange = parseSceneParams(`// @param angle "Roof" Angle (0-90)\nconst angle = 45;`);
    expect(medRange[0].step).toBe(1);

    // range <= 1000 -> step 5
    const largeRange = parseSceneParams(`// @param depth "Dim" Depth (0-800)\nconst depth = 400;`);
    expect(largeRange[0].step).toBe(5);

    // range > 1000 -> step 10
    const vLargeRange = parseSceneParams(`// @param width "Dim" Width (0-10000)\nconst width = 5000;`);
    expect(vLargeRange[0].step).toBe(10);
  });

  it("parses fractional min/max values", () => {
    const script = `// @param thickness "Wall" Thickness (0.1-2.5)
const thickness = 1.2;`;
    const params = parseSceneParams(script);
    expect(params[0].min).toBe(0.1);
    expect(params[0].max).toBe(2.5);
    expect(params[0].value).toBe(1.2);
  });
});

describe("applyParamToScript", () => {
  it("updates a const variable value", () => {
    const script = `const height = 2400;
scene.add(box(6000, height, 200));`;
    const result = applyParamToScript(script, "height", 3000);
    expect(result).toContain("const height = 3000;");
    expect(result).toContain("scene.add(box(6000, height, 200));");
  });

  it("updates a let variable value", () => {
    const script = `let width = 6000;`;
    const result = applyParamToScript(script, "width", 8000);
    expect(result).toContain("let width = 8000;");
  });

  it("updates a var variable value", () => {
    const script = `var depth = 4000;`;
    const result = applyParamToScript(script, "depth", 5000);
    expect(result).toContain("var depth = 5000;");
  });

  it("only updates the targeted variable, not others", () => {
    const script = `const width = 6000;
const height = 2400;`;
    const result = applyParamToScript(script, "height", 3000);
    expect(result).toContain("const width = 6000;");
    expect(result).toContain("const height = 3000;");
  });

  it("does not modify script when variable name is not found", () => {
    const script = `const height = 2400;`;
    const result = applyParamToScript(script, "nonexistent", 999);
    expect(result).toBe(script);
  });

  it("handles decimal values correctly", () => {
    const script = `const thickness = 0.15;`;
    const result = applyParamToScript(script, "thickness", 0.25);
    expect(result).toContain("const thickness = 0.25;");
  });

  it("handles negative values", () => {
    const script = `const offset = -100;`;
    const result = applyParamToScript(script, "offset", -200);
    expect(result).toContain("const offset = -200;");
  });
});

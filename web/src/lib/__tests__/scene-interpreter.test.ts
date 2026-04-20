import { describe, it, expect } from "vitest";
import { parseSceneParams, applyParamToScript } from "@/lib/scene-interpreter";
import type { SceneParam } from "@/lib/scene-interpreter";

// ---------------------------------------------------------------------------
// 1. parseSceneParams
// ---------------------------------------------------------------------------

describe("parseSceneParams", () => {
  it("parses multiple @param annotations with correct fields", () => {
    const script = `
// @param wallHeight "Dimensions" Wall Height (1-10)
const wallHeight = 3;

// @param wallWidth "Dimensions" Wall Width (0.5-20)
const wallWidth = 6;

// @param roofAngle "Roof" Angle (0-90)
const roofAngle = 45;
    `.trim();

    const params = parseSceneParams(script);

    expect(params).toHaveLength(3);

    expect(params[0].name).toBe("wallHeight");
    expect(params[0].section).toBe("Dimensions");
    expect(params[0].label).toBe("Wall Height");
    expect(params[0].min).toBe(1);
    expect(params[0].max).toBe(10);
    expect(params[0].value).toBe(3);
    // range = 9, so step should be 1
    expect(params[0].step).toBe(1);

    expect(params[1].name).toBe("wallWidth");
    expect(params[1].section).toBe("Dimensions");
    expect(params[1].label).toBe("Wall Width");
    expect(params[1].min).toBe(0.5);
    expect(params[1].max).toBe(20);
    expect(params[1].value).toBe(6);

    expect(params[2].name).toBe("roofAngle");
    expect(params[2].section).toBe("Roof");
    expect(params[2].label).toBe("Angle");
    expect(params[2].min).toBe(0);
    expect(params[2].max).toBe(90);
    expect(params[2].value).toBe(45);
  });

  it("returns empty array when script has no @param annotations", () => {
    const script = `
const height = 5;
const width = 10;
scene.add(box(width, height, 1));
    `.trim();

    const params = parseSceneParams(script);
    expect(params).toEqual([]);
  });

  it("returns empty array for empty script", () => {
    expect(parseSceneParams("")).toEqual([]);
  });

  it("picks up the current value from the const declaration", () => {
    const script = `
// @param depth "Layout" Depth (1-50)
const depth = 25;
    `.trim();

    const params = parseSceneParams(script);
    expect(params).toHaveLength(1);
    expect(params[0].value).toBe(25);
    // Value should come from the `const depth = 25` line, not default to min
    expect(params[0].value).not.toBe(params[0].min);
  });

  it("defaults value to min when no matching const declaration exists", () => {
    const script = `
// @param missingVar "Section" Missing Var (5-50)
// no const declaration for missingVar
    `.trim();

    const params = parseSceneParams(script);
    expect(params).toHaveLength(1);
    expect(params[0].value).toBe(5); // defaults to min
  });

  it("computes step = 1 for range <= 1", () => {
    const script = `
// @param opacity "Visual" Opacity (0-1)
const opacity = 0.5;
    `.trim();

    const params = parseSceneParams(script);
    expect(params[0].step).toBe(1);
    expect(params[0].min).toBe(0);
    expect(params[0].max).toBe(1);
  });

  it("computes step = 1 for range <= 100", () => {
    const script = `
// @param height "Dimensions" Height (0-100)
const height = 50;
    `.trim();

    const params = parseSceneParams(script);
    expect(params[0].step).toBe(1);
  });

  it("computes step = 5 for range <= 1000", () => {
    const script = `
// @param length "Dimensions" Length (0-500)
const length = 250;
    `.trim();

    const params = parseSceneParams(script);
    expect(params[0].step).toBe(5);
  });

  it("computes step = 10 for range > 1000", () => {
    const script = `
// @param budget "Cost" Budget (0-5000)
const budget = 2000;
    `.trim();

    const params = parseSceneParams(script);
    expect(params[0].step).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 2. applyParamToScript
// ---------------------------------------------------------------------------

describe("applyParamToScript", () => {
  it("replaces a const declaration value", () => {
    const script = "const wallHeight = 3;";
    const result = applyParamToScript(script, "wallHeight", 7);
    expect(result).toBe("const wallHeight = 7;");
  });

  it("handles let declarations", () => {
    const script = "let spacing = 2;";
    const result = applyParamToScript(script, "spacing", 5);
    expect(result).toBe("let spacing = 5;");
  });

  it("handles var declarations", () => {
    const script = "var count = 10;";
    const result = applyParamToScript(script, "count", 20);
    expect(result).toBe("var count = 20;");
  });

  it("returns original script if param name is not found", () => {
    const script = "const wallHeight = 3;\nconst width = 5;";
    const result = applyParamToScript(script, "nonExistent", 99);
    expect(result).toBe(script);
  });

  it("handles float values", () => {
    const script = "const opacity = 0.5;";
    const result = applyParamToScript(script, "opacity", 0.75);
    expect(result).toBe("const opacity = 0.75;");
  });

  it("replaces only the targeted param in a multi-line script", () => {
    const script = [
      "const wallHeight = 3;",
      "const wallWidth = 6;",
      "const roofAngle = 45;",
    ].join("\n");

    const result = applyParamToScript(script, "wallWidth", 8);
    expect(result).toContain("const wallWidth = 8;");
    // Other values remain untouched
    expect(result).toContain("const wallHeight = 3;");
    expect(result).toContain("const roofAngle = 45;");
  });

  it("replaces negative values", () => {
    const script = "const offset = -5;";
    const result = applyParamToScript(script, "offset", 10);
    expect(result).toBe("const offset = 10;");
  });

  it("handles integer replacement for a float original", () => {
    const script = "const ratio = 1.5;";
    const result = applyParamToScript(script, "ratio", 2);
    expect(result).toBe("const ratio = 2;");
  });
});

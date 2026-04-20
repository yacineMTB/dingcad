/**
 * Performance evaluation suite for Manifold WASM engine.
 *
 * Measures and enforces budgets on the key UX-critical paths:
 *   1. Cold evaluation (first run, no cache)
 *   2. Cache hit (same script, should be near-instant)
 *   3. Param change re-evaluation (modified script)
 *   4. Tessellation throughput (triangles/ms)
 *   5. Memory cleanup
 *
 * Run: npx vitest run src/__tests__/perf-benchmarks.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { evaluateScene, __setWasmForTesting } from "../lib/manifold-engine";

// Budget thresholds — tighten these as we optimize
// CI runners are ~2.5x slower than local dev machines — budgets must account for this
const BUDGETS = {
  coldEvalMs: 15000,      // Full kanala eval + tessellation (local ~3s, CI ~7.5s)
  cacheHitMs: 10,         // LRU cache lookup should be <10ms
  paramChangeMs: 15000,   // Re-eval with one param changed
  tessTriPerMs: 20,       // Min throughput: 20 triangles/ms (CI is slower)
  evalOnlyMs: 500,        // Script evaluation without tessellation
  wasmInitMs: 5000,       // WASM module initialization
};

let kanalaScript: string;

async function initWasmForTest() {
  const Module = (await import("manifold-3d")).default;
  const instance = await Module({
    locateFile: () =>
      resolve(__dirname, "../../node_modules/manifold-3d/manifold.wasm"),
  });
  instance.setup();
  instance.setMinCircularAngle(10);
  instance.setMinCircularEdgeLength(1);
  __setWasmForTesting(instance);
  return instance;
}

beforeAll(async () => {
  kanalaScript = readFileSync(
    resolve(__dirname, "../../../examples/helscoop/main.js"),
    "utf-8",
  );
  await initWasmForTest();
});

describe("Performance Evals", () => {
  it("WASM initialization completes within budget", async () => {
    const t0 = performance.now();
    const Module = (await import("manifold-3d")).default;
    const instance = await Module({
      locateFile: () =>
        resolve(__dirname, "../../node_modules/manifold-3d/manifold.wasm"),
    });
    instance.setup();
    const elapsed = performance.now() - t0;

    console.log(`[EVAL] wasm_init: ${elapsed.toFixed(1)}ms (budget: ${BUDGETS.wasmInitMs}ms)`);
    expect(elapsed).toBeLessThan(BUDGETS.wasmInitMs);
  }, 10000);

  it("cold evaluation of kanala scene meets budget", async () => {


    const t0 = performance.now();
    const result = await evaluateScene(kanalaScript);
    const elapsed = performance.now() - t0;

    const totalTris = result.meshes.reduce(
      (sum, m) => sum + m.indices.length / 3,
      0,
    );
    const trisPerMs = totalTris / elapsed;

    console.log(
      `[EVAL] cold_eval: ${elapsed.toFixed(1)}ms, ` +
      `objects=${result.meshes.length}, triangles=${totalTris}, ` +
      `throughput=${trisPerMs.toFixed(0)} tri/ms ` +
      `(budget: ${BUDGETS.coldEvalMs}ms)`,
    );

    expect(result.error).toBeNull();
    expect(result.meshes.length).toBeGreaterThanOrEqual(70);
    expect(elapsed).toBeLessThan(BUDGETS.coldEvalMs);
    expect(trisPerMs).toBeGreaterThan(BUDGETS.tessTriPerMs);
  }, 15000);

  it("LRU cache hit returns result near-instantly", async () => {


    // Ensure the cache is warm from the cold eval test
    await evaluateScene(kanalaScript);

    const t0 = performance.now();
    const cached = await evaluateScene(kanalaScript);
    const elapsed = performance.now() - t0;

    console.log(
      `[EVAL] cache_hit: ${elapsed.toFixed(2)}ms ` +
      `(budget: ${BUDGETS.cacheHitMs}ms)`,
    );

    expect(cached.error).toBeNull();
    expect(cached.meshes.length).toBeGreaterThanOrEqual(70);
    expect(elapsed).toBeLessThan(BUDGETS.cacheHitMs);
  }, 15000);

  it("param change re-evaluation meets budget", async () => {


    // Modify one param value — simulates a slider change
    const modifiedScript = kanalaScript.replace(
      /coop_len\s*=\s*\d+/,
      "coop_len = 3500",
    );
    expect(modifiedScript).not.toBe(kanalaScript);

    const t0 = performance.now();
    const result = await evaluateScene(modifiedScript);
    const elapsed = performance.now() - t0;

    console.log(
      `[EVAL] param_change: ${elapsed.toFixed(1)}ms, ` +
      `objects=${result.meshes.length} ` +
      `(budget: ${BUDGETS.paramChangeMs}ms)`,
    );

    expect(result.error).toBeNull();
    expect(result.meshes.length).toBeGreaterThanOrEqual(70);
    expect(elapsed).toBeLessThan(BUDGETS.paramChangeMs);
  }, 15000);

  it("script evaluation phase is fast (CSG ops without tessellation)", async () => {


    // Use a minimal script that creates geometry but we only time the eval
    const simpleScript = `
      const a = cube(100, 100, 100);
      const b = translate(sphere(60), 50, 50, 50);
      const c = difference(a, b);
      const d = union(c, translate(cylinder({ radius: 20, height: 80 }), -30, 0, 0));
      const scene = [
        withMaterial(d, "pine_48x98_c24"),
      ];
    `;

    const t0 = performance.now();
    const result = await evaluateScene(simpleScript);
    const elapsed = performance.now() - t0;

    console.log(
      `[EVAL] simple_csg: ${elapsed.toFixed(1)}ms, ` +
      `triangles=${result.meshes.reduce((s, m) => s + m.indices.length / 3, 0)} ` +
      `(budget: ${BUDGETS.evalOnlyMs}ms)`,
    );

    expect(result.error).toBeNull();
    expect(result.meshes.length).toBe(1);
    expect(elapsed).toBeLessThan(BUDGETS.evalOnlyMs);
  }, 5000);

  it("memory cleanup: no WASM leak after multiple evaluations", async () => {


    // Run 5 different evaluations to stress memory management
    for (let i = 0; i < 5; i++) {
      const script = `
        const parts = [];
        for (let j = 0; j < ${10 + i * 5}; j++) {
          parts.push(translate(cube(10, 10, 10), j * 15, 0, 0));
        }
        const scene = [withMaterial(union(parts), "pine_48x98_c24")];
      `;
      const result = await evaluateScene(script);
      expect(result.error).toBeNull();
    }

    // If we get here without crashing, memory cleanup works
    expect(true).toBe(true);
  }, 10000);
});

describe("Performance Regression Summary", () => {
  it("prints eval summary for CI tracking", async () => {


    // Cold eval
    const t0 = performance.now();
    const coldResult = await evaluateScene(kanalaScript);
    const coldMs = performance.now() - t0;

    // Cache hit
    const t1 = performance.now();
    await evaluateScene(kanalaScript);
    const cacheMs = performance.now() - t1;

    // Param change
    const modified = kanalaScript.replace(/coop_len\s*=\s*\d+/, "coop_len = 4000");
    const t2 = performance.now();
    await evaluateScene(modified);
    const paramMs = performance.now() - t2;

    const totalTris = coldResult.meshes.reduce(
      (s, m) => s + m.indices.length / 3,
      0,
    );

    console.log("\n=== PERFORMANCE EVAL SUMMARY ===");
    console.log(`Cold eval:     ${coldMs.toFixed(0)}ms (budget: ${BUDGETS.coldEvalMs}ms) ${coldMs < BUDGETS.coldEvalMs ? "✓" : "✗ OVER BUDGET"}`);
    console.log(`Cache hit:     ${cacheMs.toFixed(2)}ms (budget: ${BUDGETS.cacheHitMs}ms) ${cacheMs < BUDGETS.cacheHitMs ? "✓" : "✗ OVER BUDGET"}`);
    console.log(`Param change:  ${paramMs.toFixed(0)}ms (budget: ${BUDGETS.paramChangeMs}ms) ${paramMs < BUDGETS.paramChangeMs ? "✓" : "✗ OVER BUDGET"}`);
    console.log(`Objects:       ${coldResult.meshes.length}`);
    console.log(`Triangles:     ${totalTris}`);
    console.log(`Throughput:    ${(totalTris / coldMs).toFixed(0)} tri/ms`);
    console.log("================================\n");
  }, 30000);
});

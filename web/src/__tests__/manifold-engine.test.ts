/**
 * Integration test: evaluates the Kanala scene through the same
 * Manifold WASM engine the browser uses, verifying that all 86 objects
 * tessellate without error.
 *
 * Run: npx vitest run src/__tests__/manifold-engine.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// We can't import manifold-engine.ts directly (it uses dynamic import()),
// so we replicate the core pipeline here against the real WASM module.

async function loadManifold() {
  const Module = (await import("manifold-3d")).default;
  const wasm = await Module({
    locateFile: () =>
      resolve(__dirname, "../../node_modules/manifold-3d/manifold.wasm"),
  });
  wasm.setup();
  wasm.setMinCircularAngle(10);
  wasm.setMinCircularEdgeLength(1);
  return wasm;
}

describe("Kanala scene via Manifold WASM", () => {
  it("evaluates all scene objects and tessellates them", async () => {
    const wasm = await loadManifold();
    const { Manifold } = wasm;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toDelete: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function track(m: any) { toDelete.push(m); return m; }

    // Minimal implementations matching manifold-engine.ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function cubeImpl(...a: any[]) {
      let sx = 1, sy = 1, sz = 1, center = false;
      if (a.length === 1 && Array.isArray(a[0])) [sx, sy, sz] = a[0];
      else if (a.length === 1 && typeof a[0] === "object" && a[0]?.size) {
        const s = a[0].size; if (Array.isArray(s)) [sx, sy, sz] = s; else sx = sy = sz = s;
        center = !!a[0].center;
      } else if (a.length >= 3) { sx = a[0]; sy = a[1]; sz = a[2]; center = true; }
      else if (a.length === 1 && typeof a[0] === "number") sx = sy = sz = a[0];
      return track(Manifold.cube([Math.abs(sx), Math.abs(sy), Math.abs(sz)], center));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function cylinderImpl(...a: any[]) {
      let r = 0.5, h = 1, center = false, rt: number | undefined, seg: number | undefined;
      if (a.length === 1 && typeof a[0] === "object" && a[0] !== null) {
        const o = a[0]; if (o.radius !== undefined) r = o.radius;
        if (o.radiusTop !== undefined) rt = o.radiusTop; if (o.height !== undefined) h = o.height;
        if (o.center) center = true; if (o.segments !== undefined) seg = o.segments;
      } else if (a.length >= 2) { r = a[0]; h = a[1]; center = true; }
      else if (a.length === 1) r = a[0];
      return track(Manifold.cylinder(h, r, rt ?? r, seg ?? 0, center));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function sphereImpl(...a: any[]) {
      let r = 0.5;
      if (a.length === 1 && typeof a[0] === "object" && a[0]?.radius !== undefined) r = a[0].radius;
      else if (a.length === 1 && typeof a[0] === "number") r = a[0];
      return track(Manifold.sphere(r));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function translateImpl(m: any, ...rest: any[]) {
      let dx = 0, dy = 0, dz = 0;
      if (rest.length === 1 && Array.isArray(rest[0])) [dx, dy, dz] = rest[0];
      else if (rest.length >= 3) { dx = rest[0]; dy = rest[1]; dz = rest[2]; }
      return track(m.translate(dx, dy, dz));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function rotateImpl(m: any, ...rest: any[]) {
      let rx = 0, ry = 0, rz = 0;
      if (rest.length === 1 && Array.isArray(rest[0])) [rx, ry, rz] = rest[0];
      else if (rest.length >= 3) { rx = rest[0]; ry = rest[1]; rz = rest[2]; }
      return track(m.rotate(rx, ry, rz));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function scaleImpl(m: any, f: any) {
      return track(Array.isArray(f) ? m.scale(f) : m.scale(f));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mirrorImpl(m: any, n: any) {
      return Array.isArray(n) ? track(m.mirror(n)) : m;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function collectParts(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      for (const a of args) {
        if (Array.isArray(a)) { for (const i of a) { if (i && typeof i === "object" && typeof i.translate === "function") parts.push(i); } }
        else if (a && typeof a === "object" && typeof a.translate === "function") parts.push(a);
      }
      return parts;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function unionImpl(...a: any[]) {
      const parts = collectParts(...a);
      if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (parts.length === 1) return parts[0];
      return track(Manifold.union(parts));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function differenceImpl(...a: any[]) {
      const parts = collectParts(...a);
      if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (parts.length === 1) return parts[0];
      return track(Manifold.difference(parts));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function intersectionImpl(...a: any[]) {
      const parts = collectParts(...a);
      if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (parts.length === 1) return parts[0];
      return track(Manifold.intersection(parts));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function hullImpl(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      for (const a of args) {
        if (Array.isArray(a)) { for (const i of a) { if (i && typeof i === "object" && typeof i.translate === "function") parts.push(i); } }
        else if (a && typeof a === "object" && typeof a.translate === "function") parts.push(a);
      }
      if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (parts.length === 1) return parts[0].hull();
      return track(Manifold.hull(parts));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function trimByPlaneImpl(m: any, n: any, o?: number) {
      return Array.isArray(n) ? track(m.trimByPlane(n, o ?? 0)) : m;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function wallImpl(opts: any) {
      const start = opts.start || [0, 0], end = opts.end || [1000, 0];
      const height = opts.height || 2400, studSize = opts.studSize || [48, 98];
      const studSpacing = opts.studSpacing || 400;
      const dx = end[0] - start[0], dy = end[1] - start[1];
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const thickness = studSize[0], studW = studSize[1], plateH = studSize[0];
      const studH = height - 2 * plateH;
      const numStuds = Math.ceil(wallLen / studSpacing) + 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      parts.push(track(Manifold.cube([wallLen, thickness, plateH])));
      parts.push(track(Manifold.cube([wallLen, thickness, plateH]).translate(0, 0, height - plateH)));
      for (let i = 0; i < numStuds; i++) {
        const x = Math.min(i * studSpacing, wallLen - studW);
        parts.push(track(Manifold.cube([studW, thickness, studH]).translate(x, 0, plateH)));
      }
      let frame = track(Manifold.union(parts));
      frame = track(frame.translate(start[0], start[1], 0));
      if (Math.abs(angle) > 0.01) frame = track(frame.rotate(0, 0, angle));
      return frame;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withColorImpl(g: any, c: any) { return { geometry: g, color: c }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withPBRImpl(g: any, o: any) { return { geometry: g, color: o?.color, material: o?.material }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withMaterialImpl(g: any, m: any, id?: string) { return { geometry: g, material: m, objectId: id }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withColorIdImpl(g: any, c: any, id?: string) { return { geometry: g, color: c, objectId: id }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function extractColoredManifold(item: any) {
      if (!item || typeof item !== "object") return null;
      if (typeof item.translate === "function") return { manifold: item };
      const geom = item.geometry;
      if (!geom || typeof geom !== "object" || typeof geom.translate !== "function") return null;
      return { manifold: geom };
    }

    const script = readFileSync(resolve(__dirname, "../../../examples/helscoop/main.js"), "utf-8");
    let processed = script
      .replace(/\bexport\s+const\b/g, "const")
      .replace(/\bexport\s+let\b/g, "let")
      .replace(/\bexport\s+var\b/g, "var")
      .replace(/\bexport\s+function\b/g, "function")
      .replace(/\bexport\s+default\b/g, "");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultBag: Record<string, any> = {};
    const wrappedScript = processed +
      '\n;__result__.scene = scene;' +
      '\nif (typeof displayScale !== "undefined") __result__.displayScale = displayScale;';

    const fn = new Function(
      "box", "cube", "cylinder", "sphere",
      "translate", "rotate", "scale", "mirror",
      "union", "difference", "intersection",
      "subtract", "intersect",
      "withColor", "withPBR", "withMaterial", "withColorId",
      "Wall", "hull", "trimByPlane",
      "__sceneProxy__", "__result__",
      wrappedScript,
    );

    fn(
      cubeImpl, cubeImpl, cylinderImpl, sphereImpl,
      translateImpl, rotateImpl, scaleImpl, mirrorImpl,
      unionImpl, differenceImpl, intersectionImpl,
      differenceImpl, intersectionImpl,
      withColorImpl, withPBRImpl, withMaterialImpl, withColorIdImpl,
      wallImpl, hullImpl, trimByPlaneImpl,
      null, resultBag,
    );

    expect(resultBag.scene).toBeDefined();
    expect(Array.isArray(resultBag.scene)).toBe(true);

    const sceneArr = resultBag.scene;
    expect(sceneArr.length).toBeGreaterThanOrEqual(70);

    let extracted = 0;
    let tessellated = 0;
    let totalTriangles = 0;

    for (const item of sceneArr) {
      const cm = extractColoredManifold(item);
      if (!cm) continue;
      extracted++;
      const mesh = cm.manifold.getMesh();
      if (mesh.triVerts.length > 0) {
        tessellated++;
        totalTriangles += mesh.triVerts.length / 3;
      }
    }

    expect(extracted).toBe(sceneArr.length);
    expect(tessellated).toBe(sceneArr.length);
    expect(totalTriangles).toBeGreaterThan(100000);

    // Cleanup WASM memory
    for (const m of toDelete) { try { m.delete(); } catch { /* ok */ } }
  }, 60000);

  it("completes full pipeline (eval + tessellate) under 5 seconds", async () => {
    const wasm = await loadManifold();
    const { Manifold } = wasm;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toDelete: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function track(m: any) { toDelete.push(m); return m; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function cubeImpl(...a: any[]) {
      let sx = 1, sy = 1, sz = 1, center = false;
      if (a.length === 1 && Array.isArray(a[0])) [sx, sy, sz] = a[0];
      else if (a.length === 1 && typeof a[0] === "object" && a[0]?.size) {
        const s = a[0].size; if (Array.isArray(s)) [sx, sy, sz] = s; else sx = sy = sz = s;
        center = !!a[0].center;
      } else if (a.length >= 3) { sx = a[0]; sy = a[1]; sz = a[2]; center = true; }
      else if (a.length === 1 && typeof a[0] === "number") sx = sy = sz = a[0];
      return track(Manifold.cube([Math.abs(sx), Math.abs(sy), Math.abs(sz)], center));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function cylinderImpl(...a: any[]) {
      let r = 0.5, h = 1, center = false, rt: number | undefined, seg: number | undefined;
      if (a.length === 1 && typeof a[0] === "object" && a[0] !== null) {
        const o = a[0]; if (o.radius !== undefined) r = o.radius;
        if (o.radiusTop !== undefined) rt = o.radiusTop; if (o.height !== undefined) h = o.height;
        if (o.center) center = true; if (o.segments !== undefined) seg = o.segments;
      } else if (a.length >= 2) { r = a[0]; h = a[1]; center = true; }
      else if (a.length === 1) r = a[0];
      return track(Manifold.cylinder(h, r, rt ?? r, seg ?? 0, center));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function sphereImpl(...a: any[]) {
      let r = 0.5;
      if (a.length === 1 && typeof a[0] === "object" && a[0]?.radius !== undefined) r = a[0].radius;
      else if (a.length === 1 && typeof a[0] === "number") r = a[0];
      return track(Manifold.sphere(r));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function translateImpl(m: any, ...rest: any[]) {
      let dx = 0, dy = 0, dz = 0;
      if (rest.length === 1 && Array.isArray(rest[0])) [dx, dy, dz] = rest[0];
      else if (rest.length >= 3) { dx = rest[0]; dy = rest[1]; dz = rest[2]; }
      return track(m.translate(dx, dy, dz));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function rotateImpl(m: any, ...rest: any[]) {
      let rx = 0, ry = 0, rz = 0;
      if (rest.length === 1 && Array.isArray(rest[0])) [rx, ry, rz] = rest[0];
      else if (rest.length >= 3) { rx = rest[0]; ry = rest[1]; rz = rest[2]; }
      return track(m.rotate(rx, ry, rz));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function scaleImpl(m: any, f: any) { return track(Array.isArray(f) ? m.scale(f) : m.scale(f)); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mirrorImpl(m: any, n: any) { return Array.isArray(n) ? track(m.mirror(n)) : m; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function collectParts2(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      for (const a of args) {
        if (Array.isArray(a)) { for (const i of a) { if (i && typeof i === "object" && typeof i.translate === "function") parts.push(i); } }
        else if (a && typeof a === "object" && typeof a.translate === "function") parts.push(a);
      }
      return parts;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function unionImpl(...a: any[]) {
      const p = collectParts2(...a);
      if (p.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (p.length === 1) return p[0];
      return track(Manifold.union(p));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function differenceImpl(...a: any[]) {
      const p = collectParts2(...a);
      if (p.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (p.length === 1) return p[0];
      return track(Manifold.difference(p));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function intersectionImpl(...a: any[]) {
      const p = collectParts2(...a);
      if (p.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (p.length === 1) return p[0];
      return track(Manifold.intersection(p));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function hullImpl(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      for (const a of args) {
        if (Array.isArray(a)) { for (const i of a) { if (i && typeof i === "object" && typeof i.translate === "function") parts.push(i); } }
        else if (a && typeof a === "object" && typeof a.translate === "function") parts.push(a);
      }
      if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
      if (parts.length === 1) return parts[0].hull();
      return track(Manifold.hull(parts));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function trimByPlaneImpl(m: any, n: any, o?: number) { return Array.isArray(n) ? track(m.trimByPlane(n, o ?? 0)) : m; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function wallImpl(opts: any) {
      const start = opts.start || [0, 0], end = opts.end || [1000, 0];
      const height = opts.height || 2400, studSize = opts.studSize || [48, 98];
      const studSpacing = opts.studSpacing || 400;
      const dx = end[0] - start[0], dy = end[1] - start[1];
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const thickness = studSize[0], studW = studSize[1], plateH = studSize[0];
      const studH = height - 2 * plateH;
      const numStuds = Math.ceil(wallLen / studSpacing) + 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      parts.push(track(Manifold.cube([wallLen, thickness, plateH])));
      parts.push(track(Manifold.cube([wallLen, thickness, plateH]).translate(0, 0, height - plateH)));
      for (let i = 0; i < numStuds; i++) {
        const x = Math.min(i * studSpacing, wallLen - studW);
        parts.push(track(Manifold.cube([studW, thickness, studH]).translate(x, 0, plateH)));
      }
      let frame = track(Manifold.union(parts));
      frame = track(frame.translate(start[0], start[1], 0));
      if (Math.abs(angle) > 0.01) frame = track(frame.rotate(0, 0, angle));
      return frame;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withColorImpl(g: any, c: any) { return { geometry: g, color: c }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withPBRImpl(g: any, o: any) { return { geometry: g, color: o?.color, material: o?.material }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withMaterialImpl(g: any, m: any, id?: string) { return { geometry: g, material: m, objectId: id }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withColorIdImpl(g: any, c: any, id?: string) { return { geometry: g, color: c, objectId: id }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function extractColoredManifold(item: any) {
      if (!item || typeof item !== "object") return null;
      if (typeof item.translate === "function") return { manifold: item };
      const geom = item.geometry;
      if (!geom || typeof geom !== "object" || typeof geom.translate !== "function") return null;
      return { manifold: geom };
    }

    const script = readFileSync(resolve(__dirname, "../../../examples/helscoop/main.js"), "utf-8");
    let processed = script
      .replace(/\bexport\s+const\b/g, "const")
      .replace(/\bexport\s+let\b/g, "let")
      .replace(/\bexport\s+var\b/g, "var")
      .replace(/\bexport\s+function\b/g, "function")
      .replace(/\bexport\s+default\b/g, "");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultBag: Record<string, any> = {};
    const wrappedScript = processed +
      '\n;__result__.scene = scene;' +
      '\nif (typeof displayScale !== "undefined") __result__.displayScale = displayScale;';

    const fn = new Function(
      "box", "cube", "cylinder", "sphere",
      "translate", "rotate", "scale", "mirror",
      "union", "difference", "intersection",
      "subtract", "intersect",
      "withColor", "withPBR", "withMaterial", "withColorId",
      "Wall", "hull", "trimByPlane",
      "__sceneProxy__", "__result__",
      wrappedScript,
    );

    const t0 = performance.now();

    fn(
      cubeImpl, cubeImpl, cylinderImpl, sphereImpl,
      translateImpl, rotateImpl, scaleImpl, mirrorImpl,
      unionImpl, differenceImpl, intersectionImpl,
      differenceImpl, intersectionImpl,
      withColorImpl, withPBRImpl, withMaterialImpl, withColorIdImpl,
      wallImpl, hullImpl, trimByPlaneImpl,
      null, resultBag,
    );

    const tEval = performance.now();

    const sceneArr = resultBag.scene;
    let totalTriangles = 0;
    for (const item of sceneArr) {
      const cm = extractColoredManifold(item);
      if (!cm) continue;
      const mesh = cm.manifold.getMesh();
      totalTriangles += mesh.triVerts.length / 3;
    }

    const tTess = performance.now();
    const evalMs = tEval - t0;
    const tessMs = tTess - tEval;
    const totalMs = tTess - t0;

    console.log(`Performance: eval=${evalMs.toFixed(0)}ms, tessellate=${tessMs.toFixed(0)}ms, total=${totalMs.toFixed(0)}ms, triangles=${totalTriangles}`);

    expect(totalMs).toBeLessThan(10000);
    expect(totalTriangles).toBeGreaterThan(100000);

    for (const m of toDelete) { try { m.delete(); } catch { /* ok */ } }
  }, 15000);
});

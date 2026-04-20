/**
 * Manifold WASM Web Worker
 *
 * Runs Manifold CSG boolean operations and tessellation off the main thread.
 * Communicates with the main thread via structured postMessage protocol.
 *
 * Message protocol:
 *   Main -> Worker:
 *     { type: "evaluate", id: number, script: string }
 *   Worker -> Main:
 *     { type: "progress", id: number, meshes: SerializedMesh[], done: number, total: number }
 *     { type: "result", id: number, result: SerializedSceneResult, transfers: ArrayBuffer[] }
 *     { type: "ready" }
 *     { type: "error", id: number, error: string }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ManifoldToplevel = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Manifold = any;

/** Serialized mesh data that can be transferred via postMessage */
export interface SerializedMesh {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  color: [number, number, number];
  material: string;
  objectId?: string;
}

export interface SerializedSceneResult {
  meshes: SerializedMesh[];
  error: string | null;
  errorLine: number | null;
  warnings: string[];
  displayScale?: number;
}

export interface WorkerEvaluateMessage {
  type: "evaluate";
  id: number;
  script: string;
}

export interface WorkerProgressMessage {
  type: "progress";
  id: number;
  meshes: SerializedMesh[];
  done: number;
  total: number;
}

export interface WorkerResultMessage {
  type: "result";
  id: number;
  result: SerializedSceneResult;
}

export interface WorkerReadyMessage {
  type: "ready";
}

export interface WorkerErrorMessage {
  type: "error";
  id: number;
  error: string;
}

export type WorkerOutMessage =
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerReadyMessage
  | WorkerErrorMessage;

export type WorkerInMessage = WorkerEvaluateMessage;

// ─── Worker implementation ──────────────────────────────────────────────────

let wasm: ManifoldToplevel | null = null;

// LRU cache for evaluation results
const CACHE_SIZE = 4;
const resultCache = new Map<string, SerializedSceneResult>();

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

interface ColoredManifold {
  manifold: Manifold;
  color: [number, number, number];
  material: string;
  objectId?: string;
}

const MATERIAL_COLORS: Record<string, [number, number, number]> = {
  "pine_48x98_c24": [1, 0.95, 0.85],
  "pine_48x148_c24": [1, 0.95, 0.85],
  "pressure_treated_48x148": [0.65, 0.72, 0.55],
  "pressure_treated_148x148": [0.6, 0.68, 0.5],
  "osb_9mm": [0.85, 0.75, 0.60],
  "osb_18mm": [0.85, 0.75, 0.60],
  "exterior_board_yellow": [0.95, 0.82, 0.28],
  "galvanized_roofing": [0.75, 0.76, 0.78],
  "galvanized_flashing": [0.7, 0.7, 0.73],
  "hardware_cloth": [0.65, 0.65, 0.68],
  "insulation_100mm": [0.95, 0.92, 0.55],
  "vapor_barrier": [0.15, 0.15, 0.18],
  "exterior_paint_red": [0.65, 0.22, 0.15],
  "exterior_paint_yellow": [0.92, 0.78, 0.35],
  "exterior_paint_gray_door": [0.45, 0.48, 0.52],
  "exterior_paint_white": [0.96, 0.95, 0.93],
  "hinges_galvanized": [0.68, 0.68, 0.7],
  "joist_hanger": [0.72, 0.72, 0.74],
  "screws_50mm": [0.6, 0.58, 0.55],
  "concrete_block": [0.55, 0.55, 0.52],
  "builders_sand": [0.85, 0.78, 0.6],
  "nest_box_plywood": [0.55, 0.42, 0.3],
  "trim_21x45": [0.88, 0.78, 0.58],
  "door_thermal_bridge": [0.42, 0.46, 0.52],
  "assembly_lumber_preview": [0.85, 0.72, 0.52],
  "vent_thermal_bridge": [0.3, 0.3, 0.35],
  "nest_access_thermal_bridge": [0.75, 0.65, 0.5],
  "cedar_post_98x98": [0.62, 0.7, 0.52],
};

function materialColor(materialId: string): [number, number, number] {
  return MATERIAL_COLORS[materialId] || [0.8, 0.8, 0.8];
}

function computeNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
    const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3], by = positions[i1 * 3 + 1], bz = positions[i1 * 3 + 2];
    const cx = positions[i2 * 3], cy = positions[i2 * 3 + 1], cz = positions[i2 * 3 + 2];

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    normals[i0 * 3] += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
    normals[i1 * 3] += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
    normals[i2 * 3] += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.sqrt(normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    }
  }

  return normals;
}

function tessellateManifold(cm: ColoredManifold): SerializedMesh | null {
  const mesh = cm.manifold.getMesh();
  const numProp = mesh.numProp;
  const vp = mesh.vertProperties;
  const tri = mesh.triVerts;

  if (tri.length === 0) return null;

  const numVerts = vp.length / numProp;
  const positions = new Float32Array(numVerts * 3);
  for (let i = 0; i < numVerts; i++) {
    positions[i * 3] = vp[i * numProp];
    positions[i * 3 + 1] = vp[i * numProp + 1];
    positions[i * 3 + 2] = vp[i * numProp + 2];
  }

  const normals = computeNormals(positions, tri);

  return {
    positions,
    indices: new Uint32Array(tri),
    normals,
    color: cm.color,
    material: cm.material,
    objectId: cm.objectId,
  };
}

async function initManifold(): Promise<ManifoldToplevel> {
  if (wasm) return wasm;

  const Module = (await import("manifold-3d")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    locateFile: (path: string) => {
      if (path.endsWith(".wasm")) {
        return "/manifold.wasm";
      }
      return path;
    },
  };
  const instance = await Module(opts);
  instance.setup();
  instance.setMinCircularAngle(10);
  instance.setMinCircularEdgeLength(1);
  wasm = instance;
  return instance;
}

async function evaluateInWorker(id: number, script: string): Promise<void> {
  const hash = simpleHash(script);
  const cached = resultCache.get(hash);
  if (cached) {
    // Send cached result — clone the ArrayBuffers since cached ones must stay valid
    const clonedMeshes = cached.meshes.map(m => ({
      ...m,
      positions: new Float32Array(m.positions),
      indices: new Uint32Array(m.indices),
      normals: new Float32Array(m.normals),
    }));
    const transfers: ArrayBuffer[] = [];
    for (const m of clonedMeshes) {
      transfers.push(m.positions.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer, m.normals.buffer as ArrayBuffer);
    }
    (self as unknown as Worker).postMessage(
      { type: "progress", id, meshes: clonedMeshes, done: clonedMeshes.length, total: clonedMeshes.length } satisfies WorkerProgressMessage,
      transfers,
    );
    (self as unknown as Worker).postMessage(
      { type: "result", id, result: { ...cached, meshes: [] } } satisfies WorkerResultMessage,
    );
    return;
  }

  const warnings: string[] = [];
  const instance = await initManifold();
  const { Manifold } = instance;

  const toDelete: Manifold[] = [];

  function track(m: Manifold): Manifold {
    toDelete.push(m);
    return m;
  }

  // Primitive constructors matching the C++ viewer's js_bindings.cpp API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function cubeImpl(...rawArgs: any[]): Manifold {
    let sx = 1, sy = 1, sz = 1;
    let center = false;

    if (rawArgs.length === 1 && Array.isArray(rawArgs[0])) {
      [sx, sy, sz] = rawArgs[0];
    } else if (rawArgs.length === 1 && typeof rawArgs[0] === "object" && rawArgs[0] !== null && rawArgs[0].size) {
      const size = rawArgs[0].size;
      if (Array.isArray(size)) {
        [sx, sy, sz] = size;
      } else {
        sx = sy = sz = size;
      }
      center = !!rawArgs[0].center;
    } else if (rawArgs.length >= 3) {
      sx = rawArgs[0]; sy = rawArgs[1]; sz = rawArgs[2];
      center = true;
    } else if (rawArgs.length === 1 && typeof rawArgs[0] === "number") {
      sx = sy = sz = rawArgs[0];
    }

    return track(Manifold.cube([Math.abs(sx), Math.abs(sy), Math.abs(sz)], center));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function cylinderImpl(...rawArgs: any[]): Manifold {
    let radius = 0.5, height = 1;
    let center = false;
    let radiusTop: number | undefined;
    let segments: number | undefined;

    if (rawArgs.length === 1 && typeof rawArgs[0] === "object" && rawArgs[0] !== null) {
      const opts = rawArgs[0];
      if (opts.radius !== undefined) radius = opts.radius;
      if (opts.radiusTop !== undefined) radiusTop = opts.radiusTop;
      if (opts.height !== undefined) height = opts.height;
      if (opts.center) center = true;
      if (opts.segments !== undefined) segments = opts.segments;
    } else if (rawArgs.length >= 2) {
      radius = rawArgs[0]; height = rawArgs[1];
      center = true;
    } else if (rawArgs.length === 1) {
      radius = rawArgs[0];
    }

    return track(Manifold.cylinder(
      height,
      radius,
      radiusTop ?? radius,
      segments ?? 0,
      center
    ));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function sphereImpl(...rawArgs: any[]): Manifold {
    let radius = 0.5;

    if (rawArgs.length === 1 && typeof rawArgs[0] === "object" && rawArgs[0] !== null) {
      if (rawArgs[0].radius !== undefined) radius = rawArgs[0].radius;
    } else if (rawArgs.length === 1 && typeof rawArgs[0] === "number") {
      radius = rawArgs[0];
    }

    return track(Manifold.sphere(radius));
  }

  // Transform functions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function translateImpl(manifold: Manifold, ...rest: any[]): Manifold {
    let dx = 0, dy = 0, dz = 0;
    if (rest.length === 1 && Array.isArray(rest[0])) {
      [dx, dy, dz] = rest[0];
    } else if (rest.length >= 3) {
      dx = rest[0]; dy = rest[1]; dz = rest[2];
    }
    return track(manifold.translate(dx, dy, dz));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function rotateImpl(manifold: Manifold, ...rest: any[]): Manifold {
    let rx = 0, ry = 0, rz = 0;
    if (rest.length === 1 && Array.isArray(rest[0])) {
      [rx, ry, rz] = rest[0];
    } else if (rest.length >= 3) {
      rx = rest[0]; ry = rest[1]; rz = rest[2];
    }
    return track(manifold.rotate(rx, ry, rz));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function scaleImpl(manifold: Manifold, factor: any): Manifold {
    if (Array.isArray(factor)) {
      return track(manifold.scale(factor as [number, number, number]));
    }
    return track(manifold.scale(factor as number));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mirrorImpl(manifold: Manifold, normal: any): Manifold {
    if (Array.isArray(normal)) {
      return track(manifold.mirror(normal as [number, number, number]));
    }
    return manifold;
  }

  // Boolean operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function unionImpl(...args: any[]): Manifold {
    const parts: Manifold[] = [];
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const item of arg) {
          if (item && typeof item === "object" && typeof item.translate === "function") {
            parts.push(item);
          }
        }
      } else if (arg && typeof arg === "object" && typeof arg.translate === "function") {
        parts.push(arg);
      }
    }
    if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
    if (parts.length === 1) return parts[0];

    return track(Manifold.union(parts));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function differenceImpl(...args: any[]): Manifold {
    const parts: Manifold[] = [];
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const item of arg) {
          if (item && typeof item === "object" && typeof item.translate === "function") {
            parts.push(item);
          }
        }
      } else if (arg && typeof arg === "object" && typeof arg.translate === "function") {
        parts.push(arg);
      }
    }
    if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
    if (parts.length === 1) return parts[0];

    return track(Manifold.difference(parts));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function intersectionImpl(...args: any[]): Manifold {
    const parts: Manifold[] = [];
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const item of arg) {
          if (item && typeof item === "object" && typeof item.translate === "function") {
            parts.push(item);
          }
        }
      } else if (arg && typeof arg === "object" && typeof arg.translate === "function") {
        parts.push(arg);
      }
    }
    if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
    if (parts.length === 1) return parts[0];

    return track(Manifold.intersection(parts));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function hullImpl(...args: any[]): Manifold {
    const parts: Manifold[] = [];
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const item of arg) {
          if (item && typeof item === "object" && typeof item.translate === "function") {
            parts.push(item);
          }
        }
      } else if (arg && typeof arg === "object" && typeof arg.translate === "function") {
        parts.push(arg);
      }
    }
    if (parts.length === 0) return track(Manifold.cube([0, 0, 0]));
    if (parts.length === 1) return parts[0].hull();

    return track(Manifold.hull(parts));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function trimByPlaneImpl(manifold: Manifold, normal: any, offset?: number): Manifold {
    if (Array.isArray(normal)) {
      return track(manifold.trimByPlane(normal as [number, number, number], offset ?? 0));
    }
    return manifold;
  }

  // Wall primitive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function wallImpl(opts: any): Manifold {
    const start: [number, number] = opts.start || [0, 0];
    const end: [number, number] = opts.end || [1000, 0];
    const height: number = opts.height || 2400;
    const studSize: [number, number] = opts.studSize || [48, 98];
    const studSpacing: number = opts.studSpacing || 400;

    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const wallLen = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const thickness = studSize[0];
    const studW = studSize[1];
    const plateH = studSize[0];
    const studH = height - 2 * plateH;
    const numStuds = Math.ceil(wallLen / studSpacing) + 1;

    const parts: Manifold[] = [];

    parts.push(track(Manifold.cube([wallLen, thickness, plateH])));
    parts.push(track(
      Manifold.cube([wallLen, thickness, plateH]).translate(0, 0, height - plateH)
    ));

    for (let i = 0; i < numStuds; i++) {
      const x = Math.min(i * studSpacing, wallLen - studW);
      parts.push(track(
        Manifold.cube([studW, thickness, studH]).translate(x, 0, plateH)
      ));
    }

    let frame = track(Manifold.union(parts));

    frame = track(frame.translate(start[0], start[1], 0));
    if (Math.abs(angle) > 0.01) {
      frame = track(frame.rotate(0, 0, angle));
    }
    return frame;
  }

  // Color/material wrappers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withColorImpl(geometry: any, color: any): any {
    return { geometry, color };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withPBRImpl(geometry: any, opts: any): any {
    return { geometry, color: opts?.color, material: opts?.material };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withMaterialImpl(geometry: any, material: any, objectId?: string): any {
    return { geometry, material, objectId };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withColorIdImpl(geometry: any, color: any, objectId?: string): any {
    return { geometry, color, objectId };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractColoredManifold(item: any): ColoredManifold | null {
    if (!item || typeof item !== "object") return null;

    if (typeof item.translate === "function") {
      return { manifold: item, color: [0.8, 0.8, 0.8], material: "default" };
    }

    const geom = item.geometry;
    if (!geom || typeof geom !== "object" || typeof geom.translate !== "function") return null;

    const mat: string = typeof item.material === "string" ? item.material : "default";
    const color: [number, number, number] = Array.isArray(item.color)
      ? [item.color[0], item.color[1], item.color[2]]
      : materialColor(mat);
    const objectId: string | undefined = typeof item.objectId === "string" ? item.objectId : undefined;

    return { manifold: geom, color, material: mat, objectId };
  }

  function preprocessScript(script: string): string {
    let processed = script;
    processed = processed.replace(/\bexport\s+const\b/g, "const");
    processed = processed.replace(/\bexport\s+let\b/g, "let");
    processed = processed.replace(/\bexport\s+var\b/g, "var");
    processed = processed.replace(/\bexport\s+function\b/g, "function");
    processed = processed.replace(/\bexport\s+default\b/g, "");
    return processed;
  }

  try {
    const processed = preprocessScript(script);
    const hasOwnScene = /\b(?:const|let|var)\s+scene\b/.test(processed);

    const coloredManifolds: ColoredManifold[] = [];

    const sceneProxy = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      add(manifold: any, opts?: { material?: string; color?: [number, number, number] }) {
        if (!manifold || typeof manifold !== "object") return;
        const mat = opts?.material || "default";
        const col: [number, number, number] = opts?.color || materialColor(mat);
        if (typeof manifold.translate === "function") {
          coloredManifolds.push({ manifold, color: col, material: mat });
        }
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultBag: Record<string, any> = {};

    let wrappedScript = "";
    if (!hasOwnScene) {
      wrappedScript = "var scene = __sceneProxy__;\n" + processed;
    } else {
      wrappedScript = processed + `
;__result__.scene = scene;
if (typeof materials !== "undefined") { __result__.materials = materials; }
if (typeof displayScale !== "undefined") { __result__.displayScale = displayScale; }
`;
    }

    const fn = new Function(
      "box", "cube", "cylinder", "sphere",
      "translate", "rotate", "scale", "mirror",
      "union", "difference", "intersection",
      "subtract", "intersect",
      "withColor", "withPBR", "withMaterial", "withColorId",
      "Wall", "hull", "trimByPlane",
      "__sceneProxy__", "__result__",
      wrappedScript
    );

    fn(
      cubeImpl, cubeImpl, cylinderImpl, sphereImpl,
      translateImpl, rotateImpl, scaleImpl, mirrorImpl,
      unionImpl, differenceImpl, intersectionImpl,
      differenceImpl, intersectionImpl,
      withColorImpl, withPBRImpl, withMaterialImpl, withColorIdImpl,
      wallImpl, hullImpl, trimByPlaneImpl,
      sceneProxy, resultBag,
    );

    // Collect scene objects from the C++ export API
    if (resultBag.scene && Array.isArray(resultBag.scene)) {
      for (const item of resultBag.scene) {
        const cm = extractColoredManifold(item);
        if (cm) coloredManifolds.push(cm);
      }
    }

    // Sort manifolds by triangle count for progressive rendering
    const sorted = coloredManifolds.map(cm => ({
      cm,
      tris: cm.manifold.numTri(),
    }));
    sorted.sort((a, b) => a.tris - b.tris);

    // Tessellate with progressive reporting
    const meshes: SerializedMesh[] = [];
    for (let i = 0; i < sorted.length; i++) {
      try {
        const tess = tessellateManifold(sorted[i].cm);
        if (tess) meshes.push(tess);
      } catch {
        // Skip non-tessellatable manifolds
      }

      const expensive = sorted[i].tris > 50000;
      const batchDone = (i + 1) % 40 === 0;
      const last = i === sorted.length - 1;
      if (expensive || batchDone || last) {
        // Send progress: clone buffers so the worker retains its copies
        const progressMeshes = meshes.map(m => ({
          ...m,
          positions: new Float32Array(m.positions),
          indices: new Uint32Array(m.indices),
          normals: new Float32Array(m.normals),
        }));
        const transfers: ArrayBuffer[] = [];
        for (const m of progressMeshes) {
          transfers.push(m.positions.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer, m.normals.buffer as ArrayBuffer);
        }
        (self as unknown as Worker).postMessage(
          { type: "progress", id, meshes: progressMeshes, done: i + 1, total: sorted.length } satisfies WorkerProgressMessage,
          transfers,
        );
      }
    }

    if (meshes.length === 0 && coloredManifolds.length > 0) {
      warnings.push("validation.emptyScene");
    }

    // Cache the result (keep our own copies since we own these buffers)
    const cacheEntry: SerializedSceneResult = {
      meshes: meshes.map(m => ({
        ...m,
        positions: new Float32Array(m.positions),
        indices: new Uint32Array(m.indices),
        normals: new Float32Array(m.normals),
      })),
      error: null,
      errorLine: null,
      warnings,
      displayScale: resultBag.displayScale,
    };

    if (resultCache.size >= CACHE_SIZE) {
      const oldest = resultCache.keys().next().value;
      if (oldest !== undefined) resultCache.delete(oldest);
    }
    resultCache.set(hash, cacheEntry);

    // Send final result — transfer the original buffers (zero-copy)
    const resultTransfers: ArrayBuffer[] = [];
    for (const m of meshes) {
      resultTransfers.push(m.positions.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer, m.normals.buffer as ArrayBuffer);
    }
    const result: SerializedSceneResult = {
      meshes,
      error: null,
      errorLine: null,
      warnings,
      displayScale: resultBag.displayScale,
    };
    (self as unknown as Worker).postMessage(
      { type: "result", id, result } satisfies WorkerResultMessage,
      resultTransfers,
    );
  } catch (err) {
    const errorLine = extractErrorLine(err, script);
    (self as unknown as Worker).postMessage(
      {
        type: "result",
        id,
        result: {
          meshes: [],
          error: err instanceof Error ? err.message : String(err),
          errorLine,
          warnings,
        },
      } satisfies WorkerResultMessage,
    );
  } finally {
    for (const m of toDelete) {
      try { m.delete(); } catch { /* already deleted */ }
    }
  }
}

function extractErrorLine(err: unknown, script: string): number | null {
  if (!(err instanceof Error)) return null;

  const processed = script
    .replace(/\bexport\s+const\b/g, "const")
    .replace(/\bexport\s+let\b/g, "let")
    .replace(/\bexport\s+var\b/g, "var")
    .replace(/\bexport\s+function\b/g, "function")
    .replace(/\bexport\s+default\b/g, "");

  const hasOwnScene = /\b(?:const|let|var)\s+scene\b/.test(processed);
  const lineOffset = hasOwnScene ? 0 : 1;

  const stack = err.stack || "";
  const stackLineMatch = stack.match(
    /(?:<anonymous>|Function|eval)[^:]*:(\d+)(?::(\d+))?/
  );
  if (stackLineMatch) {
    const rawLine = parseInt(stackLineMatch[1], 10);
    if (!isNaN(rawLine)) {
      const adjusted = rawLine - 1 - lineOffset;
      if (adjusted >= 1) return adjusted;
    }
  }

  if (err instanceof SyntaxError) {
    const parenMatch = err.message.match(/\((\d+):(\d+)\)/);
    if (parenMatch) {
      const rawLine = parseInt(parenMatch[1], 10);
      if (!isNaN(rawLine)) {
        const adjusted = rawLine - lineOffset;
        if (adjusted >= 1) return adjusted;
      }
    }
  }

  return null;
}

// ─── Worker message handler ─────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  if (msg.type === "evaluate") {
    try {
      await evaluateInWorker(msg.id, msg.script);
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: "error",
        id: msg.id,
        error: err instanceof Error ? err.message : String(err),
      } satisfies WorkerErrorMessage);
    }
  }
};

// Initialize WASM eagerly and signal readiness
initManifold()
  .then(() => {
    (self as unknown as Worker).postMessage({ type: "ready" } satisfies WorkerReadyMessage);
  })
  .catch((err) => {
    (self as unknown as Worker).postMessage({
      type: "error",
      id: -1,
      error: `WASM init failed: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies WorkerErrorMessage);
  });

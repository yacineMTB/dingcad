/**
 * Scene Script Interpreter for Helscoop
 *
 * Executes scene scripts in a sandboxed manner using the Function constructor.
 * Supports two APIs:
 *   1. C++ viewer API: cube({size, center}), translate(m, [x,y,z]), scale(), export const scene
 *   2. Simple API: box(w,h,d), scene.add(mesh, {material, color})
 *
 * The model coordinate system is Z-up (matching Manifold/C++ viewer).
 * The Viewport3D renderer handles the conversion to Y-up for Three.js.
 */

export type MeshType = "box" | "cylinder" | "sphere" | "group" | "hull" | "difference" | "intersection";

export interface MeshDescriptor {
  type: MeshType;
  args: number[];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  children?: MeshDescriptor[];
  hullVertices?: number[];
}

export interface SceneObject {
  geometry: MeshType;
  args: number[];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: [number, number, number];
  material: string;
  objectId?: string;
  children?: SceneObject[];
  hullVertices?: number[];
}

function createMesh(
  type: MeshDescriptor["type"],
  args: number[]
): MeshDescriptor {
  return {
    type,
    args,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

// ── Primitives ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cubeImpl(...rawArgs: any[]): MeshDescriptor {
  let sx = 1, sy = 1, sz = 1;
  let center = false;

  if (rawArgs.length === 1 && Array.isArray(rawArgs[0])) {
    [sx, sy, sz] = rawArgs[0];
  } else if (rawArgs.length === 1 && typeof rawArgs[0] === "object" && rawArgs[0] !== null && rawArgs[0].size) {
    [sx, sy, sz] = rawArgs[0].size;
    center = !!rawArgs[0].center;
  } else if (rawArgs.length >= 3) {
    sx = rawArgs[0]; sy = rawArgs[1]; sz = rawArgs[2];
    center = true;
  } else if (rawArgs.length === 1 && typeof rawArgs[0] === "number") {
    sx = sy = sz = rawArgs[0];
  }

  const mesh = createMesh("box", [Math.abs(sx), Math.abs(sy), Math.abs(sz)]);
  if (!center) {
    mesh.position = [sx / 2, sy / 2, sz / 2];
  }
  return mesh;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cylinderImpl(...rawArgs: any[]): MeshDescriptor {
  let radius = 0.5, height = 1;
  let center = false;

  if (rawArgs.length === 1 && typeof rawArgs[0] === "object" && rawArgs[0] !== null) {
    if (rawArgs[0].radius !== undefined) radius = rawArgs[0].radius;
    if (rawArgs[0].height !== undefined) height = rawArgs[0].height;
    if (rawArgs[0].center) center = true;
  } else if (rawArgs.length >= 2) {
    radius = rawArgs[0]; height = rawArgs[1];
    center = true;
  } else if (rawArgs.length === 1) {
    radius = rawArgs[0];
  }

  const mesh = createMesh("cylinder", [radius, height]);
  if (!center) {
    mesh.position = [0, 0, height / 2];
  }
  return mesh;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sphereImpl(...rawArgs: any[]): MeshDescriptor {
  let radius = 0.5;

  if (rawArgs.length === 1 && typeof rawArgs[0] === "object" && rawArgs[0] !== null) {
    if (rawArgs[0].radius !== undefined) radius = rawArgs[0].radius;
  } else if (rawArgs.length === 1 && typeof rawArgs[0] === "number") {
    radius = rawArgs[0];
  }

  return createMesh("sphere", [radius]);
}

// ── Transforms ───────────────────────────────────────────────────────────────

function cloneMesh(mesh: MeshDescriptor): MeshDescriptor {
  return {
    ...mesh,
    position: [...mesh.position] as [number, number, number],
    rotation: [...mesh.rotation] as [number, number, number],
    scale: [...mesh.scale] as [number, number, number],
    children: mesh.children ? mesh.children.map(cloneMesh) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function translateImpl(mesh: MeshDescriptor, ...rest: any[]): MeshDescriptor {
  let dx = 0, dy = 0, dz = 0;
  if (rest.length === 1 && Array.isArray(rest[0])) {
    [dx, dy, dz] = rest[0];
  } else if (rest.length >= 3) {
    dx = rest[0]; dy = rest[1]; dz = rest[2];
  }
  const out = cloneMesh(mesh);
  out.position[0] += dx;
  out.position[1] += dy;
  out.position[2] += dz;
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rotateImpl(mesh: MeshDescriptor, ...rest: any[]): MeshDescriptor {
  let rx = 0, ry = 0, rz = 0;
  if (rest.length === 1 && Array.isArray(rest[0])) {
    [rx, ry, rz] = rest[0];
  } else if (rest.length >= 3) {
    rx = rest[0]; ry = rest[1]; rz = rest[2];
  }
  const out = cloneMesh(mesh);
  out.rotation[0] += rx;
  out.rotation[1] += ry;
  out.rotation[2] += rz;
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scaleImpl(mesh: MeshDescriptor, factor: any): MeshDescriptor {
  let sx: number, sy: number, sz: number;
  if (Array.isArray(factor)) {
    [sx, sy, sz] = factor;
  } else {
    sx = sy = sz = factor as number;
  }
  const out = cloneMesh(mesh);
  out.position[0] *= sx;
  out.position[1] *= sy;
  out.position[2] *= sz;
  out.scale[0] *= sx;
  out.scale[1] *= sy;
  out.scale[2] *= sz;
  if (out.children) {
    out.children = out.children.map(c => scaleImpl(c, factor));
  }
  return out;
}

// ── Boolean operations ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unionImpl(...args: any[]): MeshDescriptor {
  const parts: MeshDescriptor[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      parts.push(...arg);
    } else if (arg && typeof arg === "object" && arg.type) {
      parts.push(arg);
    }
  }
  if (parts.length === 0) return createMesh("group", []);
  if (parts.length === 1) return parts[0];
  return {
    type: "group",
    args: [],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    children: parts,
  };
}

function differenceImpl(...args: MeshDescriptor[]): MeshDescriptor {
  if (args.length === 0) return createMesh("group", []);
  if (args.length === 1) return args[0];
  let result = args[0];
  for (let i = 1; i < args.length; i++) {
    result = {
      type: "difference" as MeshType,
      args: [],
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      children: [result, args[i]],
    };
  }
  return result;
}

function intersectionImpl(...args: MeshDescriptor[]): MeshDescriptor {
  if (args.length === 0) return createMesh("group", []);
  if (args.length === 1) return args[0];
  let result = args[0];
  for (let i = 1; i < args.length; i++) {
    result = {
      type: "intersection" as MeshType,
      args: [],
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      children: [result, args[i]],
    };
  }
  return result;
}

// ── Higher-level primitives ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wallImpl(opts: any): MeshDescriptor {
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

  const parts: MeshDescriptor[] = [];

  // Bottom plate
  parts.push(cubeImpl({ size: [wallLen, thickness, plateH], center: false }));
  // Top plate
  parts.push(translateImpl(
    cubeImpl({ size: [wallLen, thickness, plateH], center: false }),
    [0, 0, height - plateH]
  ));

  // Studs
  for (let i = 0; i < numStuds; i++) {
    const x = Math.min(i * studSpacing, wallLen - studW);
    parts.push(translateImpl(
      cubeImpl({ size: [studW, thickness, studH], center: false }),
      [x, 0, plateH]
    ));
  }

  const frame = unionImpl(...parts);
  let result = translateImpl(frame, [start[0], start[1], 0]);
  if (Math.abs(angle) > 0.01) {
    result = rotateImpl(result, [0, 0, angle]);
  }
  return result;
}

function collectBoxCorners(mesh: MeshDescriptor): number[][] {
  const corners: number[][] = [];
  const px = mesh.position[0], py = mesh.position[1], pz = mesh.position[2];
  const sx = mesh.scale[0], sy = mesh.scale[1], sz = mesh.scale[2];

  if (mesh.type === "box") {
    const hw = (mesh.args[0] || 1) * sx / 2;
    const hh = (mesh.args[1] || 1) * sy / 2;
    const hd = (mesh.args[2] || 1) * sz / 2;
    for (const dx of [-1, 1]) {
      for (const dy of [-1, 1]) {
        for (const dz of [-1, 1]) {
          corners.push([px + dx * hw, py + dy * hh, pz + dz * hd]);
        }
      }
    }
  } else if (mesh.type === "cylinder") {
    const r = (mesh.args[0] || 0.5) * Math.max(sx, sy);
    const hh = (mesh.args[1] || 1) * sz / 2;
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      corners.push([px + r * Math.cos(angle), py + r * Math.sin(angle), pz - hh]);
      corners.push([px + r * Math.cos(angle), py + r * Math.sin(angle), pz + hh]);
    }
  } else if (mesh.type === "sphere") {
    const r = (mesh.args[0] || 0.5) * Math.max(sx, sy, sz);
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        for (const dz of [-1, 0, 1]) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          corners.push([px + (dx / len) * r, py + (dy / len) * r, pz + (dz / len) * r]);
        }
      }
    }
  } else if (mesh.type === "group" && mesh.children) {
    for (const child of mesh.children) {
      const childCorners = collectBoxCorners(child);
      for (const c of childCorners) {
        corners.push([px + c[0] * sx, py + c[1] * sy, pz + c[2] * sz]);
      }
    }
  }
  return corners;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hullImpl(...args: any[]): MeshDescriptor {
  const parts: MeshDescriptor[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      parts.push(...arg);
    } else if (arg && typeof arg === "object" && arg.type) {
      parts.push(arg);
    }
  }
  if (parts.length === 0) return createMesh("group", []);
  if (parts.length === 1) return parts[0];

  const allCorners: number[][] = [];
  for (const part of parts) {
    allCorners.push(...collectBoxCorners(part));
  }

  if (allCorners.length < 4) {
    return {
      type: "group",
      args: [],
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      children: parts,
    };
  }

  const flat: number[] = [];
  for (const c of allCorners) {
    flat.push(c[0], c[1], c[2]);
  }

  return {
    type: "hull",
    args: [],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    hullVertices: flat,
  };
}

// ── Color/material helpers (provided to script sandbox) ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withColorImpl(geometry: any, color: any): any {
  return { geometry, color };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withPBRImpl(geometry: any, opts: any): any {
  return { geometry, color: opts?.color, material: opts?.material };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withMaterialImpl(geometry: any, material: any, _objectId?: string): any {
  return { geometry, material };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withColorIdImpl(geometry: any, color: any, _objectId?: string): any {
  return { geometry, color };
}

// ── Scene export types ───────────────────────────────────────────────────────

export interface InterpreterResult {
  objects: SceneObject[];
  error: string | null;
  /** 1-based line number in the original script where the error occurred, if extractable. */
  errorLine: number | null;
  warnings: string[];
}

// ── Pre-execution validation ─────────────────────────────────────────────────

function checkBalancedDelimiters(script: string): string[] {
  const warnings: string[] = [];
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closers: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let line = 1;

  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    const next = script[i + 1];

    if (ch === "\n") {
      line++;
      inLineComment = false;
      continue;
    }

    if (inLineComment) continue;

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === "/" && next === "/") { inLineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }

    if (ch in pairs) {
      stack.push({ char: ch, line });
    } else if (ch in closers) {
      const expected = closers[ch];
      if (stack.length === 0 || stack[stack.length - 1].char !== expected) {
        warnings.push(`validation.unmatchedCloser:${ch}:${line}`);
      } else {
        stack.pop();
      }
    }
  }

  for (const open of stack) {
    warnings.push(`validation.unmatchedOpener:${open.char}:${open.line}`);
  }

  return warnings;
}

function stripComments(script: string): string {
  let result = "";
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    const next = script[i + 1];

    if (inLineComment) {
      if (ch === "\n") { inLineComment = false; result += ch; }
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; i++; }
      else if (ch === "\n") result += ch;
      continue;
    }
    if (inString) {
      result += ch;
      if (ch === "\\") { result += next || ""; i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "/" && next === "/") { inLineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; }
    result += ch;
  }
  return result;
}

const SCENE_TYPOS: [RegExp, string][] = [
  [/\bscnee\s*\./g, "scene"],
  [/\bscen\s*\./g, "scene"],
  [/\bscene\s*\.\s*ad\b/g, "scene.add"],
  [/\bscene\s*\.\s*addd\b/g, "scene.add"],
  [/\bboxx\s*\(/g, "box"],
  [/\bcyliner\s*\(/g, "cylinder"],
  [/\bshere\s*\(/g, "sphere"],
  [/\btranslte\s*\(/g, "translate"],
  [/\broate\s*\(/g, "rotate"],
];

function checkTypos(script: string): string[] {
  const stripped = stripComments(script);
  const warnings: string[] = [];
  for (const [pattern, correct] of SCENE_TYPOS) {
    if (pattern.test(stripped)) {
      warnings.push(`validation.typoDetected:${correct}`);
    }
    pattern.lastIndex = 0;
  }
  return warnings;
}

const KNOWN_IDENTIFIERS = new Set([
  "box", "cube", "cylinder", "sphere",
  "translate", "rotate", "scale",
  "union", "difference", "intersection", "subtract", "intersect",
  "withColor", "withPBR", "withMaterial", "withColorId", "Wall", "hull",
  "scene",
  "Math", "console", "const", "let", "var", "for", "if", "else",
  "while", "do", "return", "function", "true", "false", "null",
  "undefined", "new", "this", "typeof", "instanceof", "void",
  "switch", "case", "break", "continue", "throw", "try", "catch",
  "finally", "class", "extends", "import", "export", "default",
  "Array", "Object", "Number", "String", "Boolean", "JSON",
  "parseInt", "parseFloat", "isNaN", "isFinite", "Infinity", "NaN",
]);

function checkUndefinedPrimitives(script: string): string[] {
  let stripped = stripComments(script);
  // Mask string contents to avoid matching identifiers inside string literals
  stripped = stripped.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
  const warnings: string[] = [];
  const callPattern = /(?<!\.\s*)\b([a-zA-Z_]\w*)\s*\(/g;
  let match;
  const seen = new Set<string>();
  while ((match = callPattern.exec(stripped)) !== null) {
    const name = match[1];
    if (!KNOWN_IDENTIFIERS.has(name) && !seen.has(name)) {
      const defPattern = new RegExp(
        `(?:const|let|var|function)\\s+${name}\\b`
      );
      if (!defPattern.test(stripped)) {
        seen.add(name);
        warnings.push(`validation.undefinedIdentifier:${name}`);
      }
    }
  }
  return warnings;
}

function preValidate(script: string): string[] {
  return [
    ...checkBalancedDelimiters(script),
    ...checkTypos(script),
    ...checkUndefinedPrimitives(script),
  ];
}

// ── Post-execution validation ────────────────────────────────────────────────

function postValidate(objects: SceneObject[]): string[] {
  const warnings: string[] = [];

  if (objects.length === 0) {
    warnings.push("validation.emptyScene");
  }

  let totalCount = 0;
  function countObjects(objs: SceneObject[]) {
    for (const obj of objs) {
      totalCount++;
      if (obj.children) countObjects(obj.children);
    }
  }
  countObjects(objects);

  if (totalCount > 10000) {
    warnings.push(`validation.tooManyObjects:${totalCount}`);
  }

  return warnings;
}

// ── Material color lookup ────────────────────────────────────────────────────

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

// ── Conversion helpers ───────────────────────────────────────────────────────

function meshToSceneObject(
  mesh: MeshDescriptor,
  material: string,
  color: [number, number, number],
  objectId?: string,
): SceneObject {
  return {
    geometry: mesh.type,
    args: mesh.args,
    position: mesh.position,
    rotation: mesh.rotation,
    scale: mesh.scale,
    color,
    material,
    objectId,
    children: mesh.children?.map((c) => meshToSceneObject(c, material, color)),
    hullVertices: mesh.hullVertices,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coloredObjectToSceneObject(obj: any): SceneObject | null {
  if (!obj || typeof obj !== "object") return null;

  if (obj.type && obj.args) {
    return meshToSceneObject(obj as MeshDescriptor, "default", [0.8, 0.8, 0.8]);
  }

  const geom = obj.geometry;
  if (!geom || typeof geom !== "object") return null;

  const mat: string = typeof obj.material === "string" ? obj.material : "default";
  const color: [number, number, number] = Array.isArray(obj.color)
    ? [obj.color[0], obj.color[1], obj.color[2]]
    : materialColor(mat);
  const objectId: string | undefined = typeof obj.objectId === "string" ? obj.objectId : undefined;

  return meshToSceneObject(geom as MeshDescriptor, mat, color, objectId);
}

// ── Script preprocessing ─────────────────────────────────────────────────────

function preprocessScript(script: string): string {
  let processed = script;
  processed = processed.replace(/\bexport\s+const\b/g, "const");
  processed = processed.replace(/\bexport\s+let\b/g, "let");
  processed = processed.replace(/\bexport\s+var\b/g, "var");
  processed = processed.replace(/\bexport\s+function\b/g, "function");
  processed = processed.replace(/\bexport\s+default\b/g, "");
  return processed;
}

// ── @param support ───────────────────────────────────────────────────────────

export interface SceneParam {
  name: string;
  section: string;
  label: string;
  min: number;
  max: number;
  value: number;
  step: number;
}

const PARAM_REGEX = /\/\/\s*@param\s+(\w+)\s+"([^"]+)"\s+(.+?)\s+\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/;
const VALUE_REGEX = (name: string) =>
  new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(-?[\\d.]+)`);

export function parseSceneParams(script: string): SceneParam[] {
  const params: SceneParam[] = [];
  const lines = script.split("\n");
  for (const line of lines) {
    const m = PARAM_REGEX.exec(line);
    if (!m) continue;
    const [, name, section, label, minStr, maxStr] = m;
    const min = parseFloat(minStr);
    const max = parseFloat(maxStr);
    const valMatch = VALUE_REGEX(name).exec(script);
    const value = valMatch ? parseFloat(valMatch[1]) : min;
    const range = max - min;
    const step = range <= 1 ? 1 : range <= 100 ? 1 : range <= 1000 ? 5 : 10;
    params.push({ name, section, label, min, max, value, step });
  }
  return params;
}

export function applyParamToScript(
  script: string,
  paramName: string,
  newValue: number
): string {
  const re = new RegExp(
    `((?:const|let|var)\\s+${paramName}\\s*=\\s*)(-?[\\d.]+)`
  );
  return script.replace(re, `$1${newValue}`);
}

// ── Error line extraction ───────────────────────────────────────────────────

/**
 * Try to extract a 1-based line number from a JS error thrown by `new Function()`.
 *
 * For syntax errors the engine usually embeds the line directly in the message.
 * For runtime errors we inspect the stack trace for `<anonymous>:LINE:COL` or
 * `Function:LINE:COL` patterns.
 *
 * `lineOffset` is the number of lines the wrapper prepends before the user
 * script (e.g. 1 for the `var scene = __sceneProxy__;` line).
 *
 * Returns a 1-based line in the *original* user script, or null.
 */
function extractErrorLine(err: unknown, lineOffset: number): number | null {
  if (!(err instanceof Error)) return null;

  // 1. Check the stack trace for anonymous/Function line references.
  //    Common patterns:
  //      V8 (Chrome/Node):     "at anonymous (eval ...:LINE:COL)"
  //                            "at Function (<anonymous>:LINE:COL)"
  //                            "at eval (<anonymous>:LINE:COL)"
  //      Firefox:              "anonymous@debugger eval code:LINE:COL"
  //                            "@debugger eval code:LINE:COL"
  //      Safari:               "anonymous@[native code]:LINE:COL" or similar
  const stack = err.stack || "";

  // Pattern: <anonymous>:LINE:COL or eval:LINE:COL or Function:LINE:COL
  const stackLineMatch = stack.match(
    /(?:<anonymous>|Function|eval)[^:]*:(\d+)(?::(\d+))?/
  );
  if (stackLineMatch) {
    const rawLine = parseInt(stackLineMatch[1], 10);
    if (!isNaN(rawLine)) {
      // new Function() adds one implicit line for the function header
      const adjusted = rawLine - 1 - lineOffset;
      if (adjusted >= 1) return adjusted;
    }
  }

  // 2. SyntaxError messages sometimes contain the line directly.
  //    e.g. "Unexpected token '}' at line 5" or "(1:5)" notation.
  if (err instanceof SyntaxError) {
    // Check for "(LINE:COL)" pattern in message (Babel-like)
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

// ── Main interpreter ─────────────────────────────────────────────────────────

export function interpretScene(script: string): InterpreterResult {
  const warnings: string[] = [];

  warnings.push(...preValidate(script));

  const objects: SceneObject[] = [];

  const sceneProxy = {
    add(
      mesh: MeshDescriptor,
      opts?: { material?: string; color?: [number, number, number] }
    ) {
      const mat = opts?.material || "default";
      const col: [number, number, number] = opts?.color || [0.8, 0.8, 0.8];
      objects.push(meshToSceneObject(mesh, mat, col));
    },
  };

  try {
    const processed = preprocessScript(script);

    // Detect which API the script uses:
    // - "scene.add()" API: scene is a proxy object
    // - "export const scene = [...]" API: scene is a user-declared array
    const hasOwnScene = /\b(?:const|let|var)\s+scene\b/.test(processed);

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
      "box",
      "cube",
      "cylinder",
      "sphere",
      "translate",
      "rotate",
      "scale",
      "union",
      "difference",
      "intersection",
      "subtract",
      "intersect",
      "withColor",
      "withPBR",
      "withMaterial",
      "withColorId",
      "Wall",
      "hull",
      "__sceneProxy__",
      "__result__",
      wrappedScript
    );

    fn(
      cubeImpl,
      cubeImpl,
      cylinderImpl,
      sphereImpl,
      translateImpl,
      rotateImpl,
      scaleImpl,
      unionImpl,
      differenceImpl,
      intersectionImpl,
      differenceImpl,
      intersectionImpl,
      withColorImpl,
      withPBRImpl,
      withMaterialImpl,
      withColorIdImpl,
      wallImpl,
      hullImpl,
      sceneProxy,
      resultBag,
    );

    if (resultBag.scene && Array.isArray(resultBag.scene)) {
      for (const item of resultBag.scene) {
        const sceneObj = coloredObjectToSceneObject(item);
        if (sceneObj) objects.push(sceneObj);
      }
    }

    warnings.push(...postValidate(objects));

    return { objects, error: null, errorLine: null, warnings };
  } catch (err) {
    const errorLine = extractErrorLine(err, hasOwnSceneOffset(script));
    return {
      objects,
      error: err instanceof Error ? err.message : String(err),
      errorLine,
      warnings,
    };
  }
}

/** Helper: determine the line offset for the given script. */
function hasOwnSceneOffset(script: string): number {
  const processed = preprocessScript(script);
  const hasOwnScene = /\b(?:const|let|var)\s+scene\b/.test(processed);
  return hasOwnScene ? 0 : 1;
}

/**
 * Extract unique material names from an array of scene objects.
 * Walks the full object tree (including children) and filters out "default".
 */
export function extractSceneMaterials(objects: SceneObject[]): string[] {
  const names = new Set<string>();
  function walk(obj: SceneObject) {
    if (obj.material && obj.material !== "default") {
      names.add(obj.material);
    }
    obj.children?.forEach(walk);
  }
  objects.forEach(walk);
  return Array.from(names);
}

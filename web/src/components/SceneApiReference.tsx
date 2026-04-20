"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@/components/LocaleProvider";

/* ── DSL function definitions ──────────────────────────────── */

interface FunctionDoc {
  name: string;
  signature: string;
  description: string;
  params: { name: string; type: string; desc: string }[];
  returns: string;
  example: string;
}

interface CookbookEntry {
  title: string;
  description: string;
  code: string;
}

const PRIMITIVES: FunctionDoc[] = [
  {
    name: "box",
    signature: "box(width, height, depth)",
    description: "Create a rectangular box mesh.",
    params: [
      { name: "width", type: "number", desc: "Width along X axis (meters)" },
      { name: "height", type: "number", desc: "Height along Y axis (meters)" },
      { name: "depth", type: "number", desc: "Depth along Z axis (meters)" },
    ],
    returns: "Mesh",
    example: "const wall = box(4, 2.8, 0.15);",
  },
  {
    name: "cylinder",
    signature: "cylinder(radius, height)",
    description: "Create a cylindrical mesh.",
    params: [
      { name: "radius", type: "number", desc: "Radius in meters" },
      { name: "height", type: "number", desc: "Height along Y axis (meters)" },
    ],
    returns: "Mesh",
    example: "const column = cylinder(0.15, 3);",
  },
  {
    name: "sphere",
    signature: "sphere(radius)",
    description: "Create a sphere mesh.",
    params: [
      { name: "radius", type: "number", desc: "Radius in meters" },
    ],
    returns: "Mesh",
    example: "const dome = sphere(2);",
  },
];

const TRANSFORMS: FunctionDoc[] = [
  {
    name: "translate",
    signature: "translate(mesh, x, y, z)",
    description: "Move a mesh by the given offset. Returns a new mesh; the original is unchanged.",
    params: [
      { name: "mesh", type: "Mesh", desc: "The mesh to move" },
      { name: "x", type: "number", desc: "Offset along X axis (meters)" },
      { name: "y", type: "number", desc: "Offset along Y axis (meters)" },
      { name: "z", type: "number", desc: "Offset along Z axis (meters)" },
    ],
    returns: "Mesh",
    example: "const moved = translate(box(1, 1, 1), 3, 0, 0);",
  },
  {
    name: "rotate",
    signature: "rotate(mesh, rx, ry, rz)",
    description: "Rotate a mesh by the given angles in radians. Returns a new mesh.",
    params: [
      { name: "mesh", type: "Mesh", desc: "The mesh to rotate" },
      { name: "rx", type: "number", desc: "Rotation around X axis (radians)" },
      { name: "ry", type: "number", desc: "Rotation around Y axis (radians)" },
      { name: "rz", type: "number", desc: "Rotation around Z axis (radians)" },
    ],
    returns: "Mesh",
    example: "const tilted = rotate(box(2, 0.05, 3), 0.3, 0, 0);",
  },
];

const BOOLEANS: FunctionDoc[] = [
  {
    name: "union",
    signature: "union(a, b)",
    description: "Combine two meshes into a single group.",
    params: [
      { name: "a", type: "Mesh", desc: "First mesh" },
      { name: "b", type: "Mesh", desc: "Second mesh" },
    ],
    returns: "Mesh",
    example: "const combined = union(wall, floor);",
  },
  {
    name: "subtract",
    signature: "subtract(a, b)",
    description: "Subtract mesh B from mesh A (boolean difference). Used for cutting holes.",
    params: [
      { name: "a", type: "Mesh", desc: "Base mesh" },
      { name: "b", type: "Mesh", desc: "Mesh to subtract" },
    ],
    returns: "Mesh",
    example: 'const wallWithHole = subtract(wall, doorOpening);',
  },
  {
    name: "intersect",
    signature: "intersect(a, b)",
    description: "Keep only the overlapping volume of two meshes.",
    params: [
      { name: "a", type: "Mesh", desc: "First mesh" },
      { name: "b", type: "Mesh", desc: "Second mesh" },
    ],
    returns: "Mesh",
    example: "const overlap = intersect(a, b);",
  },
];

const SCENE_ADD: FunctionDoc = {
  name: "scene.add",
  signature: "scene.add(mesh, options?)",
  description: "Add a mesh to the scene with optional material and color.",
  params: [
    { name: "mesh", type: "Mesh", desc: "The mesh to add to the scene" },
    { name: "options.material", type: "string", desc: 'Material name, e.g. "lumber", "foundation", "roofing"' },
    { name: "options.color", type: "[r, g, b]", desc: "RGB color array, each 0-1, e.g. [0.85, 0.75, 0.55]" },
  ],
  returns: "void",
  example: 'scene.add(wall, { material: "lumber", color: [0.85, 0.75, 0.55] });',
};

const COOKBOOK: CookbookEntry[] = [
  {
    title: "Cut a door from a wall",
    description: "Use subtract() to cut a rectangular opening in a wall.",
    code: `const wall = translate(box(6, 2.8, 0.15), 0, 1.5, 0);
const doorHole = translate(box(0.9, 2.1, 0.15), 1.5, 1.05, 0);
const wallWithDoor = subtract(wall, doorHole);
scene.add(wallWithDoor, { material: "lumber", color: [0.85, 0.75, 0.55] });`,
  },
  {
    title: "Add a window",
    description: "Subtract a smaller box from a wall for a window opening.",
    code: `const wall = translate(box(4, 2.8, 0.15), 0, 1.5, -2);
const windowHole = translate(box(1.2, 1.0, 0.15), 0, 1.6, -2);
const wallWithWindow = subtract(wall, windowHole);
scene.add(wallWithWindow, { material: "lumber", color: [0.85, 0.75, 0.55] });`,
  },
  {
    title: "Create a pitched roof",
    description: "Two rotated panels meeting at the ridge.",
    code: `const left = translate(rotate(box(2.5, 0.05, 5), 0, 0, 0.52), -1.1, 3.0, 0);
const right = translate(rotate(box(2.5, 0.05, 5), 0, 0, -0.52), 1.1, 3.0, 0);
scene.add(left, { material: "roofing", color: [0.35, 0.32, 0.30] });
scene.add(right, { material: "roofing", color: [0.35, 0.32, 0.30] });`,
  },
  {
    title: "Round column",
    description: "A vertical cylinder with foundation material.",
    code: `const col = translate(cylinder(0.15, 2.8), 0, 1.4, 0);
scene.add(col, { material: "foundation", color: [0.7, 0.7, 0.7] });`,
  },
  {
    title: "Four-wall room",
    description: "A simple room with floor and four walls.",
    code: `const floor = box(4, 0.2, 3);
const w1 = translate(box(4, 2.5, 0.12), 0, 1.35, -1.44);
const w2 = translate(box(4, 2.5, 0.12), 0, 1.35, 1.44);
const w3 = translate(box(0.12, 2.5, 3), -1.94, 1.35, 0);
const w4 = translate(box(0.12, 2.5, 3), 1.94, 1.35, 0);
scene.add(floor, { material: "foundation", color: [0.65, 0.65, 0.65] });
scene.add(w1, { material: "lumber", color: [0.82, 0.68, 0.47] });
scene.add(w2, { material: "lumber", color: [0.82, 0.68, 0.47] });
scene.add(w3, { material: "lumber", color: [0.82, 0.68, 0.47] });
scene.add(w4, { material: "lumber", color: [0.82, 0.68, 0.47] });`,
  },
  {
    title: "Terrace with posts",
    description: "A raised deck supported by four posts.",
    code: `const deck = translate(box(3, 0.08, 2), 0, 0.5, 0);
const p1 = translate(box(0.1, 0.5, 0.1), -1.3, 0.25, -0.8);
const p2 = translate(box(0.1, 0.5, 0.1), 1.3, 0.25, -0.8);
const p3 = translate(box(0.1, 0.5, 0.1), -1.3, 0.25, 0.8);
const p4 = translate(box(0.1, 0.5, 0.1), 1.3, 0.25, 0.8);
scene.add(deck, { material: "lumber", color: [0.78, 0.65, 0.45] });
scene.add(p1, { material: "lumber", color: [0.65, 0.55, 0.38] });
scene.add(p2, { material: "lumber", color: [0.65, 0.55, 0.38] });
scene.add(p3, { material: "lumber", color: [0.65, 0.55, 0.38] });
scene.add(p4, { material: "lumber", color: [0.65, 0.55, 0.38] });`,
  },
];

const MATERIALS = [
  { id: "foundation", color: [0.7, 0.7, 0.7], label: "Foundation / Betoni" },
  { id: "lumber", color: [0.85, 0.75, 0.55], label: "Lumber / Sahatavara" },
  { id: "roofing", color: [0.35, 0.32, 0.30], label: "Roofing / Katto" },
  { id: "insulation", color: [0.95, 0.85, 0.55], label: "Insulation / Eristys" },
  { id: "pipe", color: [0.5, 0.5, 0.5], label: "Pipe / Putki" },
  { id: "stone", color: [0.6, 0.6, 0.55], label: "Stone / Kivi" },
  { id: "default", color: [0.8, 0.8, 0.8], label: "Default" },
];

const COORD_NOTE = `Coordinate system:
  Y is up (vertical)
  X is left-right
  Z is front-back
  All dimensions are in meters.
  Origin (0, 0, 0) is at the center of the ground plane.`;

/* ── Component ─────────────────────────────────────────────── */

function FunctionCard({
  fn,
  onCopy,
}: {
  fn: FunctionDoc;
  onCopy: (code: string) => void;
}) {
  return (
    <div className="api-ref-card">
      <div className="api-ref-sig">
        <code>{fn.signature}</code>
        <span className="api-ref-returns">&rarr; {fn.returns}</span>
      </div>
      <div className="api-ref-desc">{fn.description}</div>
      <div className="api-ref-params">
        {fn.params.map((p) => (
          <div key={p.name} className="api-ref-param">
            <code className="api-ref-param-name">{p.name}</code>
            <span className="api-ref-param-type">{p.type}</span>
            <span className="api-ref-param-desc">{p.desc}</span>
          </div>
        ))}
      </div>
      <div className="api-ref-example">
        <code>{fn.example}</code>
        <button
          className="api-ref-copy-btn"
          onClick={() => onCopy(fn.example)}
          title="Copy to clipboard"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

type Section = "primitives" | "transforms" | "booleans" | "scene" | "materials" | "cookbook" | "coords";

export default function SceneApiReference({
  onInsertCode,
}: {
  onInsertCode?: (code: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("primitives");
  const { t } = useTranslation();

  const copyToClipboard = (code: string) => {
    if (onInsertCode) {
      onInsertCode(code);
    } else {
      navigator.clipboard.writeText(code);
    }
  };

  const sections: { key: Section; label: string }[] = [
    { key: "primitives", label: "Primitives" },
    { key: "transforms", label: "Transforms" },
    { key: "booleans", label: "Booleans" },
    { key: "scene", label: "scene.add" },
    { key: "materials", label: "Materials" },
    { key: "cookbook", label: "Cookbook" },
    { key: "coords", label: "Coords" },
  ];

  const allFunctions = useMemo(
    () => [...PRIMITIVES, ...TRANSFORMS, ...BOOLEANS, SCENE_ADD],
    []
  );

  const filteredFunctions = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return allFunctions.filter(
      (fn) =>
        fn.name.toLowerCase().includes(q) ||
        fn.description.toLowerCase().includes(q) ||
        fn.params.some((p) => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))
    );
  }, [search, allFunctions]);

  const filteredCookbook = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return COOKBOOK.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q)
    );
  }, [search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="api-ref-panel">
      {/* Header */}
      <div className="api-ref-header">
        <div className="api-ref-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Scene API</span>
        </div>
        <div className="api-ref-search-wrap">
          <svg className="api-ref-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="api-ref-search"
            placeholder={t('editor.searchDocs') || "Search functions..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="api-ref-search-clear"
              onClick={() => setSearch("")}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Section tabs (hidden during search) */}
      {!isSearching && (
        <div className="api-ref-tabs">
          {sections.map((s) => (
            <button
              key={s.key}
              className={`api-ref-tab ${activeSection === s.key ? "api-ref-tab-active" : ""}`}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="api-ref-content">
        {/* Search results */}
        {isSearching && (
          <div>
            {filteredFunctions && filteredFunctions.length > 0 && (
              <div>
                <div className="api-ref-section-label">Functions</div>
                {filteredFunctions.map((fn) => (
                  <FunctionCard key={fn.name} fn={fn} onCopy={copyToClipboard} />
                ))}
              </div>
            )}
            {filteredCookbook && filteredCookbook.length > 0 && (
              <div>
                <div className="api-ref-section-label">Cookbook</div>
                {filteredCookbook.map((entry) => (
                  <div key={entry.title} className="api-ref-cookbook-entry">
                    <div className="api-ref-cookbook-title">{entry.title}</div>
                    <div className="api-ref-cookbook-desc">{entry.description}</div>
                    <div className="api-ref-cookbook-code">
                      <pre>{entry.code}</pre>
                      <button
                        className="api-ref-copy-btn"
                        onClick={() => copyToClipboard(entry.code)}
                        title="Copy to editor"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(!filteredFunctions || filteredFunctions.length === 0) &&
              (!filteredCookbook || filteredCookbook.length === 0) && (
              <div className="api-ref-empty">
                No results for &quot;{search}&quot;
              </div>
            )}
          </div>
        )}

        {/* Primitives */}
        {!isSearching && activeSection === "primitives" && (
          <div>
            <div className="api-ref-section-label">Primitive shapes</div>
            {PRIMITIVES.map((fn) => (
              <FunctionCard key={fn.name} fn={fn} onCopy={copyToClipboard} />
            ))}
          </div>
        )}

        {/* Transforms */}
        {!isSearching && activeSection === "transforms" && (
          <div>
            <div className="api-ref-section-label">Transform functions</div>
            {TRANSFORMS.map((fn) => (
              <FunctionCard key={fn.name} fn={fn} onCopy={copyToClipboard} />
            ))}
          </div>
        )}

        {/* Booleans */}
        {!isSearching && activeSection === "booleans" && (
          <div>
            <div className="api-ref-section-label">Boolean operations</div>
            {BOOLEANS.map((fn) => (
              <FunctionCard key={fn.name} fn={fn} onCopy={copyToClipboard} />
            ))}
          </div>
        )}

        {/* scene.add */}
        {!isSearching && activeSection === "scene" && (
          <div>
            <div className="api-ref-section-label">Adding to the scene</div>
            <FunctionCard fn={SCENE_ADD} onCopy={copyToClipboard} />
          </div>
        )}

        {/* Materials */}
        {!isSearching && activeSection === "materials" && (
          <div>
            <div className="api-ref-section-label">Built-in materials</div>
            <div className="api-ref-materials">
              {MATERIALS.map((m) => (
                <div key={m.id} className="api-ref-material">
                  <div
                    className="api-ref-material-swatch"
                    style={{
                      background: `rgb(${m.color.map((c) => Math.round(c * 255)).join(",")})`,
                    }}
                  />
                  <code className="api-ref-material-id">{m.id}</code>
                  <span className="api-ref-material-label">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="api-ref-hint">
              Use <code>material: &quot;{"{name}"}&quot;</code> in <code>scene.add()</code> options.
              Color can be customized with <code>color: [r, g, b]</code> (values 0-1).
            </div>
          </div>
        )}

        {/* Cookbook */}
        {!isSearching && activeSection === "cookbook" && (
          <div>
            <div className="api-ref-section-label">Common patterns</div>
            {COOKBOOK.map((entry) => (
              <div key={entry.title} className="api-ref-cookbook-entry">
                <div className="api-ref-cookbook-title">{entry.title}</div>
                <div className="api-ref-cookbook-desc">{entry.description}</div>
                <div className="api-ref-cookbook-code">
                  <pre>{entry.code}</pre>
                  <button
                    className="api-ref-copy-btn"
                    onClick={() => copyToClipboard(entry.code)}
                    title="Copy to editor"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coords */}
        {!isSearching && activeSection === "coords" && (
          <div>
            <div className="api-ref-section-label">Coordinate system</div>
            <pre className="api-ref-coords">{COORD_NOTE}</pre>
            <div className="api-ref-hint">
              All mesh primitives are centered at the origin by default.
              Use <code>translate(mesh, x, y, z)</code> to position them.
              For example, <code>translate(box(1, 2, 1), 0, 1, 0)</code> places the box
              with its center at Y=1 (bottom at Y=0).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

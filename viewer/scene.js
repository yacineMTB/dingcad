const spacing = 2.8;
const columns = 8;
const baseShapes = [];

function translateToGrid(manifold, index) {
  const col = index % columns;
  const row = Math.floor(index / columns);
  return translate(manifold, [col * spacing, 0, row * spacing]);
}

function failMarker() {
  const pillar = cube({ size: [0.6, 1.6, 0.6], center: true });
  return translate(pillar, [0, 0.8, 0]);
}

function test(name, builder) {
  try {
    const result = builder();
    if (!result) throw new Error(`${name} returned null`);
    baseShapes.push(result);
  } catch (error) {
    baseShapes.push(failMarker());
  }
}

test("cube", () => cube({ size: [1, 1, 1], center: true }));

test("sphere", () => sphere({ radius: 0.7 }));

test("cylinder", () => cylinder({ height: 1.2, radius: 0.35, center: true }));

test("tetrahedron", () => tetrahedron());

test("union", () => union(
  cube({ size: [0.8, 0.8, 0.8], center: true }),
  translate(sphere({ radius: 0.45 }), [0.4, 0.2, 0])
));

test("difference", () => difference(
  cube({ size: [1, 1, 1], center: true }),
  translate(sphere({ radius: 0.6 }), [0.2, 0.2, 0])
));

test("intersection", () => intersection(
  sphere({ radius: 0.7 }),
  translate(cube({ size: [1.1, 1.1, 1.1], center: true }), [0.2, 0, 0])
));

test("translate", () => translate(
  cube({ size: [0.6, 0.6, 0.6], center: true }),
  [0.4, 0.3, 0]
));

test("scale", () => scale(sphere({ radius: 0.6 }), 0.6));

test("rotate", () => rotate(
  cylinder({ height: 1.0, radius: 0.3, center: true }),
  [45, 0, 30]
));

test("mirror", () => mirror(
  translate(cube({ size: [0.4, 0.8, 0.4], center: true }), [0.4, 0.3, 0]),
  [1, 0, 0]
));

test("transform", () => transform(
  cube({ size: [0.6, 0.6, 0.6], center: true }),
  [1, 0, 0, 0.3,
   0, 1, 0, 0.2,
   0, 0, 1, 0.1]
));

test("compose", () => compose([
  translate(cube({ size: [0.5, 0.5, 0.5], center: true }), [-0.35, 0, 0]),
  translate(sphere({ radius: 0.35 }), [0.4, 0, 0])
]));

test("decompose", () => {
  const combo = compose([
    translate(cube({ size: [0.4, 0.4, 0.4], center: true }), [-0.35, 0, 0]),
    translate(cube({ size: [0.4, 0.4, 0.4], center: true }), [0.45, 0, 0])
  ]);
  const parts = decompose(combo);
  return compose(parts);
});

test("boolean", () => boolean(
  cube({ size: [0.9, 0.9, 0.9], center: true }),
  translate(sphere({ radius: 0.55 }), [0.35, 0, 0]),
  "difference"
));

test("batchBoolean", () => batchBoolean("add", [
  translate(cube({ size: [0.4, 0.4, 0.4], center: true }), [-0.45, 0, 0]),
  cube({ size: [0.4, 0.4, 0.4], center: true }),
  translate(cube({ size: [0.4, 0.4, 0.4], center: true }), [0.45, 0, 0])
]));

test("hull", () => hull(
  translate(cube({ size: [0.3, 0.7, 0.3], center: true }), [-0.45, 0, 0]),
  translate(sphere({ radius: 0.4 }), [0.6, 0.25, 0])
));

test("hullPoints", () => hullPoints([
  [-0.4, -0.4, -0.4],
  [0.7, -0.3, -0.1],
  [-0.2, 0.8, 0.2],
  [0.1, 0, 0.9]
]));

test("trimByPlane", () => trimByPlane(
  cube({ size: [1, 1, 1], center: true }),
  [0, 1, 0],
  0
));

test("tolerance", () => {
  const base = cube({ size: [1, 1, 1], center: true });
  const adjusted = setTolerance(base, 0.002);
  const tol = getTolerance(adjusted);
  return translate(scale(adjusted, 0.7), [0, tol * 120, 0]);
});

test("simplify", () => {
  const noisy = union(
    sphere({ radius: 0.6 }),
    translate(cube({ size: [0.2, 0.2, 1.2], center: true }), [0, 0.6, 0])
  );
  return simplify(noisy, 0.05);
});

test("refine", () => refine(sphere({ radius: 0.55 }), 1));

test("refineToLength", () => refineToLength(
  cylinder({ height: 1.0, radius: 0.4, center: true }),
  0.3
));

test("refineToTolerance", () => refineToTolerance(
  cube({ size: [0.9, 0.9, 0.9], center: true }),
  0.05
));

test("extrude", () => {
  const outline = [
    [[-0.4, -0.2], [0, 0.35], [0.4, -0.2]]
  ];
  return extrude(outline, {
    height: 0.8,
    divisions: 6,
    twistDegrees: 15,
    scaleTop: [0.6, 0.6]
  });
});

test("revolve", () => {
  const profile = [
    [[0, 0], [0.4, 0], [0.4, 0.6], [0, 0.6]]
  ];
  return revolve(profile, { segments: 32, degrees: 270 });
});

test("slice", () => {
  const shape = union(
    cube({ size: [1, 1, 1], center: true }),
    translate(sphere({ radius: 0.5 }), [0, 0.6, 0])
  );
  const loops = slice(shape, 0.2);
  return extrude(loops, { height: 0.2 });
});

test("project", () => {
  const shape = rotate(
    cylinder({ height: 1.2, radius: 0.3, center: true }),
    [90, 0, 0]
  );
  const loops = project(shape);
  return extrude(loops, { height: 0.2 });
});

test("levelSet", () => levelSet({
  sdf: (p) => Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) - 0.5 + 0.1 * Math.sin(3 * p[0]),
  bounds: { min: [-0.7, -0.7, -0.7], max: [0.7, 0.7, 0.7] },
  edgeLength: 0.2,
  tolerance: 0.01
}));

test("minGap", () => {
  const a = cube({ size: [0.5, 0.5, 0.5], center: true });
  const b = translate(a, [1.2, 0, 0]);
  const gap = minGap(a, b, 2.0);
  return translate(union(a, b), [gap * 0.1, 0, 0]);
});

test("properties", () => {
  const base = sphere({ radius: 0.6 });
  const withNormals = calculateNormals(base, 0, 40);
  const withCurvature = calculateCurvature(withNormals, -1, 0);
  const smoothed = smoothByNormals(withNormals, 0);
  const relaxed = smoothOut(smoothed, 30, 0.2);
  const propCount = numProperties(withCurvature);
  const propVerts = numPropertyVertices(withCurvature);
  const asOrig = asOriginal(relaxed);
  const id = originalId(asOrig);
  const nextId = reserveIds(2);
  const factor = propCount > 0 && propVerts > 0 ? 0.75 : 0.35;
  return translate(scale(asOrig, factor), [0, (id + nextId) * 0.02, 0]);
});

test("metrics", () => {
  const core = difference(
    sphere({ radius: 0.7 }),
    cube({ size: [0.6, 0.6, 0.6], center: true })
  );
  const accent = translate(cylinder({ height: 0.8, radius: 0.2, center: true }), [0, 0.6, 0]);
  const shape = union(core, accent);
  const area = surfaceArea(shape);
  const vol = volume(shape);
  const box = boundingBox(shape);
  const tris = numTriangles(shape);
  const verts = numVertices(shape);
  const edges = numEdges(shape);
  const g = genus(shape);
  const stat = status(shape);
  const emptyShape = difference(
    cube({ size: [0.5, 0.5, 0.5], center: true }),
    cube({ size: [0.5, 0.5, 0.5], center: true })
  );
  const empty = isEmpty(emptyShape);
  const scaleFactor = empty ? 0.3 : Math.min(0.3 + area / 50, 0.9);
  const density = vol > 0 ? area / vol : 1;
  const combinatorics = tris + verts + edges;
  const lift = (box.max[1] - box.min[1]) * 0.1 + g * 0.05 + (stat === "NoError" ? 0 : 0.2) + density * 0.05 + combinatorics * 0.00005;
  return translate(scale(shape, scaleFactor), [0, lift, 0]);
});

const repeatCount = 200;
const placed = [];
if (baseShapes.length > 0) {
  for (let r = 0; r < repeatCount; ++r) {
    for (const shape of baseShapes) {
      placed.push(translateToGrid(shape, placed.length));
    }
  }
}

if (placed.length === 0) {
  scene = cube({ size: [1, 1, 1], center: true });
} else {
  scene = compose(placed);
}

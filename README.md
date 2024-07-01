# dingcad
<img src="https://github.com/yacineMTB/dingcad/assets/10282244/15ab2781-f540-4833-801e-416442b258f6" alt="wordart (6)" style="width:200px;height:100px;">

This is dingcad. These are yacine's personal scripts used to design cad shapes.

Dingcad allows you to write cad scripts and have live reloading on a web browser. Design fast! Every time you save, out.glb gets replaced.

Big thanks to elalish and manifold cad. Some projects make me feel very little. Manfioldcad is one of those projects.

### DINGCAD! usage

```
git clone https://github.com/yacineMTB/dingcad/ && cd dingcad
npm run install
npm run cad
open https://localhost:3000
nvim main_assembly.ts
# now, on saving the web view should automatically reload!
```

### Ding software philosophy

I've purposefully made dingcad to be a bunch of scripts that I just use.
I've avoided making it an npm module because it's important for me to hack on it
This is very much a work in progress. But I think it's better than openscad!
If you don't like the renderer, it's a single index.html file. Just change it!
If you want to add parts, please do!

### Code docs

Thes come from manifold js definitions. I'm not sure what all of these do! I'm not too great at cad

### Why typescript?

manifold_lib was ripped from manifoldcad and I was too lazy to detypescript it

```ts
// Triangulates polygons
export function triangulate(polygons: Polygons, precision?: number): Vec3[];

// Circular shape quantization defaults
export function setMinCircularAngle(angle: number): void;
export function setMinCircularEdgeLength(length: number): void;
export function setCircularSegments(segments: number): void;
export function getCircularSegments(radius: number): number;
export function resetToCircularDefaults(): void;

export class CrossSection {
  constructor(polygons: Polygons, fillRule?: FillRule);
  static square(size?: Vec2|number, center?: boolean): CrossSection;
  static circle(radius: number, circularSegments?: number): CrossSection;
  extrude(
      height: number, nDivisions?: number, twistDegrees?: number,
      scaleTop?: Vec2|number, center?: boolean): Manifold;
  revolve(circularSegments?: number, revolveDegrees?: number): Manifold;
  transform(m: Mat3): CrossSection;
  translate(v: Vec2): CrossSection;
  translate(x: number, y?: number): CrossSection;
  rotate(v: number): CrossSection;
  scale(v: Vec2|number): CrossSection;
  mirror(v: Vec2): CrossSection;
  warp(warpFunc: (vert: Vec2) => void): CrossSection;
  offset(
      delta: number, joinType?: JoinType, miterLimit?: number,
      circularSegments?: number): CrossSection;
  simplify(epsilon?: number): CrossSection;
  add(other: CrossSection|Polygons): CrossSection;
  subtract(other: CrossSection|Polygons): CrossSection;
  intersect(other: CrossSection|Polygons): CrossSection;
  static union(a: CrossSection|Polygons, b: CrossSection|Polygons): CrossSection;
  static difference(a: CrossSection|Polygons, b: CrossSection|Polygons): CrossSection;
  static intersection(a: CrossSection|Polygons, b: CrossSection|Polygons): CrossSection;
  static union(polygons: (CrossSection|Polygons)[]): CrossSection;
  static difference(polygons: (CrossSection|Polygons)[]): CrossSection;
  static intersection(polygons: (CrossSection|Polygons)[]): CrossSection;
  hull(): CrossSection;
  static hull(polygons: (CrossSection|Polygons)[]): CrossSection;
  static compose(polygons: (CrossSection|Polygons)[]): CrossSection;
  decompose(): CrossSection[];
  static ofPolygons(polygons: Polygons, fillRule?: FillRule): CrossSection;
  toPolygons(): SimplePolygon[];
  area(): number;
  isEmpty(): boolean;
  numVert(): number;
  numContour(): number;
  bounds(): Rect;
  delete(): void;
}

export class Manifold {
  constructor(mesh: Mesh);
  static tetrahedron(): Manifold;
  static cube(size?: Vec3|number, center?: boolean): Manifold;
  static cylinder(
      height: number, radiusLow: number, radiusHigh?: number,
      circularSegments?: number, center?: boolean): Manifold;
  static sphere(radius: number, circularSegments?: number): Manifold;
  static extrude(
      polygons: CrossSection|Polygons, height: number, nDivisions?: number,
      twistDegrees?: number, scaleTop?: Vec2|number,
      center?: boolean): Manifold;
  static revolve(
      polygons: CrossSection|Polygons, circularSegments?: number,
      revolveDegrees?: number): Manifold;
  static ofMesh(mesh: Mesh): Manifold;
  static smooth(mesh: Mesh, sharpenedEdges?: Smoothness[]): Manifold;
  static levelSet(
      sdf: (point: Vec3) => number, bounds: Box, edgeLength: number,
      level?: number): Manifold;
  transform(m: Mat4): Manifold;
  translate(v: Vec3): Manifold;
  translate(x: number, y?: number, z?: number): Manifold;
  rotate(v: Vec3): Manifold;
  rotate(x: number, y?: number, z?: number): Manifold;
  scale(v: Vec3|number): Manifold;
  mirror(v: Vec3): Manifold;
  warp(warpFunc: (vert: Vec3) => void): Manifold;
  static smoothByNormals(normalIdx: number): Manifold;
  static smoothOut(minSharpAngle?: number, minSmoothness?: number): Manifold;
  refine(n: number): Manifold;
  refineToLength(length: number): Manifold;
  setProperties(
      numProp: number,
      propFunc: (newProp: number[], position: Vec3, oldProp: number[]) => void):
      Manifold;
  calculateCurvature(gaussianIdx: number, meanIdx: number): Manifold;
  calculateNormals(normalIdx: number, minSharpAngle: number): Manifold;
  add(other: Manifold): Manifold;
  subtract(other: Manifold): Manifold;
  intersect(other: Manifold): Manifold;
  static union(a: Manifold, b: Manifold): Manifold;
  static difference(a: Manifold, b: Manifold): Manifold;
  static intersection(a: Manifold, b: Manifold): Manifold;
  static union(manifolds: Manifold[]): Manifold;
  static difference(manifolds: Manifold[]): Manifold;
  static intersection(manifolds: Manifold[]): Manifold;
  split(cutter: Manifold): Manifold[];
  splitByPlane(normal: Vec3, originOffset: number): Manifold[];
  trimByPlane(normal: Vec3, originOffset: number): Manifold;
  slice(height: number): CrossSection;
  project(): CrossSection;
  hull(): Manifold;
  static hull(points: (Manifold|Vec3)[]): Manifold;
  static compose(manifolds: Manifold[]): Manifold;
  decompose(): Manifold[];
  isEmpty(): boolean;
  numVert(): number;
  numTri(): number;
  numEdge(): number;
  numProp(): number;
  numPropVert(): number;
  boundingBox(): Box;
  precision(): number;
  genus(): number;
  getProperties(): Properties;
  minGap(other: Manifold, searchLength: number): number;
}

```

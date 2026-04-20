// Gyroid Sculpture - Helscoop levelSet example
// Demonstrates procedural SDF geometry with boolean operations
// Coordinate convention: X=width, Y=depth, Z=height (up)

// @param size "Gyroid" Cube Size (30-120)
const size = 60;
// @param thickness "Gyroid" Wall Thickness (2-8)
const thickness = 3;
// @param cells "Gyroid" Cells per Axis (2-6)
const cells = 4;
// @param base_height "Gyroid" Base Height (3-15)
const base_height = 5;

const S = 0.004;
export const displayScale = S;

const COPPER = [0.72, 0.45, 0.20];

const half = size / 2;
const k = cells * Math.PI * 2 / size;
const period = size / cells;
const wallParam = thickness / period;

const gyroidLattice = levelSet({
  sdf: (p) => {
    const g = Math.sin(k * p[0]) * Math.cos(k * p[1])
            + Math.sin(k * p[1]) * Math.cos(k * p[2])
            + Math.sin(k * p[2]) * Math.cos(k * p[0]);
    return Math.abs(g) - wallParam;
  },
  bounds: { min: [-half, -half, -half], max: [half, half, half] },
  edgeLength: 1.0,
});

// Cut away front-bottom quarter to expose internal structure
const cutBlock = translate(
  cube([half + 1, half + 1, half + 1]),
  [0, -half - 1, -half - 1]
);
const sculpture = difference(gyroidLattice, cutBlock);

// Pedestal base
const base = translate(
  cylinder({ height: base_height, radius: half * 0.7, segments: 64 }),
  [0, 0, -half - base_height]
);

const piece = union(sculpture, base);

export const scene = [
  withPBR(scale(piece, S), { color: COPPER, metallic: 0.7, roughness: 0.35 }),
];

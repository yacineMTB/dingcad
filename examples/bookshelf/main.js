// Parametric Bookshelf - Helscoop pattern & boolean example
// Coordinate convention: X=width, Y=depth, Z=height (up)

// @param width "Shelf" Width (400-1600)
const width = 800;
// @param height "Shelf" Height (600-2400)
const height = 1800;
// @param depth "Shelf" Depth (200-400)
const depth = 300;
// @param shelves "Shelf" Number of Shelves (2-8)
const shelves = 5;
// @param board_thickness "Shelf" Board Thickness (12-25)
const board_thickness = 18;
// @param back_thickness "Shelf" Back Panel (3-12)
const back_thickness = 6;

const S = 0.003;
export const displayScale = S;

const WALNUT = [0.35, 0.22, 0.12];
const WALNUT_LIGHT = [0.45, 0.30, 0.16];
const PLYWOOD = [0.65, 0.55, 0.40];

const inner_w = width - 2 * board_thickness;
const inner_h = height - 2 * board_thickness;
const shelf_spacing = inner_h / (shelves - 1);

// Side panels (tall in Z)
const leftSide = cube([board_thickness, depth, height]);
const rightSide = translate(cube([board_thickness, depth, height]),
  [width - board_thickness, 0, 0]);
const sides = union(leftSide, rightSide);

// Top and bottom (thin in Z)
const topBoard = translate(cube([inner_w, depth, board_thickness]),
  [board_thickness, 0, height - board_thickness]);
const bottomBoard = translate(cube([inner_w, depth, board_thickness]),
  [board_thickness, 0, 0]);
const caps = union(topBoard, bottomBoard);

// Internal shelves (pattern along Z axis)
const shelfBoard = translate(cube([inner_w, depth, board_thickness]),
  [board_thickness, 0, 0]);
const internalShelves = linearPattern(shelfBoard, shelves - 2,
  [0, 0, shelf_spacing]);
const allShelves = translate(internalShelves, [0, 0, board_thickness + shelf_spacing]);

// Back panel (thin in Y, at the back)
const backPanel = translate(
  cube([width, back_thickness, height]),
  [0, depth - back_thickness, 0]
);

// Assemble
export const scene = [
  withPBR(scale(union(sides, caps), S), { color: WALNUT, roughness: 0.4, metallic: 0.0 }),
  withPBR(scale(allShelves, S), { color: WALNUT_LIGHT, roughness: 0.45, metallic: 0.0 }),
  withPBR(scale(backPanel, S), { color: PLYWOOD, roughness: 0.6, metallic: 0.0 }),
];

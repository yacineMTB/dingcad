import buildDTSPCB from './library/DTSPCB.js';

const roundedBox = (width, depth, height, radius) => {
  const clamped = Math.min(Math.max(radius, 0), width / 2, depth / 2);
  if (clamped === 0) {
    return cube({ size: [width, depth, height], center: true });
  }
  const corner = cylinder({ height, radius: clamped, center: true });
  const offsetX = width / 2 - clamped;
  const offsetY = depth / 2 - clamped;
  const corners = [
    [-offsetX, -offsetY],
    [offsetX, -offsetY],
    [-offsetX, offsetY],
    [offsetX, offsetY],
  ].map(([x, y]) => translate(corner, [x, y, 0]));
  return hull(...corners);
};

const centerOnFloor = (manifold) => {
  const bounds = boundingBox(manifold);
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  return translate(manifold, [-centerX, -centerY, -bounds.min[2]]);
};

const rawModule = buildDTSPCB();

// Stand the board on its width so the long edge becomes vertical, then center on the floor plane.
const baseModule = centerOnFloor(rotate(rawModule, [0, 90, 0]));

const baseBounds = boundingBox(baseModule);
const halfDepth = (baseBounds.max[0] - baseBounds.min[0]) / 2;
const spacing = 8;

const angles = [0, 90, 180, 270];
const harnessModules = angles.map((angle) => {
  const oriented = rotate(baseModule, [0, 0, angle]);
  const radians = (angle * Math.PI) / 180;
  const offset = [
    Math.cos(radians) * (halfDepth + spacing),
    Math.sin(radians) * (halfDepth + spacing),
    0,
  ];
  return translate(oriented, offset);
});


const size = 27;
const pillarSize = [size, size, 26];
const outerCornerRadius = 8;
const centeredPillar = roundedBox(pillarSize[0], pillarSize[1], pillarSize[2], outerCornerRadius);
const pillarBounds = boundingBox(centeredPillar);
const pillarFloorAligned = translate(centeredPillar, [0, 0, -pillarBounds.min[2]]);

const wallThickness = 5.;
const innerSize = size - wallThickness * 2;
const innerPillar = cube({ size: [21, innerSize, 23], center: true });
const innerBounds = boundingBox(innerPillar);
const innerFloorAligned = translate(innerPillar, [0, 0, -innerBounds.min[2]]);

const hollowPillar = difference(pillarFloorAligned, innerFloorAligned);

const sixthModule = translate(centerOnFloor(rotate(rawModule, [0, 0, 0])), [0,0,22])
const scaledModules = union(...harnessModules, sixthModule);
const harnessShell = scale(difference(hollowPillar, scaledModules), 1.03);

export const scene = difference(harnessShell, sixthModule);

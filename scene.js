import buildDTSPCB from './library/DTSPCB.js';

const rawModule = buildDTSPCB();

// Stand the board on its width so the long edge becomes vertical.
const widthOriented = rotate(rawModule, [0, 90, 0]);
const widthBounds = boundingBox(widthOriented);
const floorAligned = translate(widthOriented, [0, 0, -widthBounds.min[2]]);

// Center the module in the horizontal plane for easier arraying.
const floorBounds = boundingBox(floorAligned);
const centerX = (floorBounds.min[0] + floorBounds.max[0]) / 2;
const centerY = (floorBounds.min[1] + floorBounds.max[1]) / 2;
const centeredModule = translate(floorAligned, [-centerX, -centerY, 0]);

const centeredBounds = boundingBox(centeredModule);
const halfDepth = centeredBounds.max[0];
const spacing = 8;

const angles = [0, 90, 180, 270];
const harnessModules = angles.map((angle) => {
  const oriented = rotate(centeredModule, [0, 0, angle]);
  const radians = (angle * Math.PI) / 180;
  const offset = [
    Math.cos(radians) * (halfDepth + spacing),
    Math.sin(radians) * (halfDepth + spacing),
    0,
  ];
  return translate(oriented, offset);
});


const size = 27
const pillarSize = [size, size, 23];
const centeredPillar = cube({ size: pillarSize, center: true });
const pillarBounds = boundingBox(centeredPillar);
const pillarFloorAligned = translate(centeredPillar, [0, 0, -pillarBounds.min[2]]);

const wallThickness = 5.5;
const innerSize = size - wallThickness * 2;
const innerPillar = cube({ size: [innerSize, innerSize, size], center: true });
const innerBounds = boundingBox(innerPillar);
const innerFloorAligned = translate(innerPillar, [0, 0, -innerBounds.min[2]]);

const hollowPillar = difference(pillarFloorAligned, innerFloorAligned);

const scaledModules = union(...harnessModules);

export const scene = scale(difference(hollowPillar, scaledModules), 1.05);

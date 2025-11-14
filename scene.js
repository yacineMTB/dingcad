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
const esp32MeshPath = '~/Downloads/models/seedespc3.stl';
const rawEsp32Mesh = loadMesh(esp32MeshPath, true);

// Connector dimensions match the DTS PCB layout so we can clear the shell wall.
const pcbWidth = 21;
const pcbHeight = 15;
const pcbThickness = 1.6;
const componentSize = 8.8;
const connectorWidth = 6.0;
const connectorDepth = 8.0;
const connectorTotalHeight = 2.6;
const connectorGapX = 0.4;

const rawModuleBounds = boundingBox(rawModule);
const moduleCenterX = (rawModuleBounds.min[0] + rawModuleBounds.max[0]) / 2;
const moduleCenterY = (rawModuleBounds.min[1] + rawModuleBounds.max[1]) / 2;

const componentOffsetX = pcbWidth - 3.7 - componentSize;
const componentOffsetY = pcbHeight - 3 - componentSize;
const connectorOffsetX = Math.min(componentOffsetX + componentSize + connectorGapX, pcbWidth - connectorWidth);
const connectorOffsetY = componentOffsetY + componentSize / 2 - connectorDepth / 2;
const connectorHeight = connectorTotalHeight - pcbThickness;

const centeredConnector = [
  connectorOffsetX + connectorWidth / 2 - moduleCenterX,
  connectorOffsetY + connectorDepth / 2 - moduleCenterY,
  pcbThickness + connectorHeight / 2,
];

// Stand the board on its width so the long edge becomes vertical, then center on the floor plane.
const baseModule = centerOnFloor(rotate(rawModule, [0, 90, 0]));

const baseBounds = boundingBox(baseModule);
const halfDepth = (baseBounds.max[0] - baseBounds.min[0]) / 2;
const spacing = 8;

const angles = [ 90, 180, 270];
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


const size = 28.3;
const pillarSize = [size, size, size-.1];
const outerCornerRadius = 3;
const centeredPillar = roundedBox(pillarSize[0], pillarSize[1], pillarSize[2], outerCornerRadius);
const pillarBounds = boundingBox(centeredPillar);
const pillarFloorAligned = translate(centeredPillar, [0, 0, -pillarBounds.min[2]]);

const wallThickness = 5.;
const innerSize = size - wallThickness * 2;
const innerPillar = cube({ size: [21, 21, 22], center: true });
const innerBounds = boundingBox(innerPillar);
const innerFloorAligned = translate(innerPillar, [0, 0, -innerBounds.min[2]]);

const hollowPillar = difference(pillarFloorAligned, innerFloorAligned);

const sixthModuleOffset = [0, 0, 22];
const sixthModule = translate(centerOnFloor(rawModule), sixthModuleOffset);
const esp32Mesh = translate(
  rotate(centerOnFloor(rawEsp32Mesh), [0, 90, 0]),
  [
    sixthModuleOffset[0] + 10,
    sixthModuleOffset[1],
    sixthModuleOffset[2] - 10,
  ],
);
const scaledModules = union(...harnessModules, sixthModule);
const harnessShell = scale(difference(hollowPillar, scaledModules), 1.035);

const connectorInsideClearance = 3.0;
const connectorOutsideExtension = 5.0;
const connectorLateralClearance = 8;
const connectorVerticalClearance = 4;

const connectorHoleLength = connectorWidth + connectorInsideClearance + connectorOutsideExtension;
const connectorHoleDepth = connectorDepth + connectorLateralClearance;
const connectorHoleHeight = connectorHeight + connectorVerticalClearance;

const connectorHoleCenter = [
  centeredConnector[0] + (connectorOutsideExtension - connectorInsideClearance) / 2 + sixthModuleOffset[0],
  centeredConnector[1] + sixthModuleOffset[1],
  centeredConnector[2] + sixthModuleOffset[2] - 3,
];

const connectorHole = translate(
  cube({
    size: [connectorHoleLength, connectorHoleDepth, connectorHoleHeight],
    center: true,
  }),
  connectorHoleCenter,
);


const fronthole = translate(
  cube({size: [5, 20, 33], center: true}),
  [10, 0, 10]
);

const harnessWithConnector = difference(harnessShell, connectorHole,  fronthole);

// export const scene = harnessWithConnector;
//export const scene = applyShader(harnessWithConnector, './viewer/assets/matcaps/2A2A2A_DBDBDB_6A6A6A_949494-512px.png');
// Matcap options (uncomment one to switch)
// export const scene = applyShader(harnessWithConnector, './viewer/assets/matcaps/0A0A0A_A9A9A9_525252_747474-512px.png');
// export const scene = applyShader(harnessWithConnector, './viewer/assets/matcaps/0C0CC3_04049F_040483_04045C-512px.png');
 export const scene = applyShader(harnessWithConnector, './viewer/assets/matcaps/0C430C_257D25_439A43_3C683C-512px.png');
// export const scene = applyShader(harnessWithConnector, './viewer/assets/matcaps/0D0DBD_040497_04047B_040455-512px.png');

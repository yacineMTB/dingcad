// the back case of a radio; with cylinders that allow for m2 bolts to go through to the end. the box has rounded corners on the outside, making it look spic and span
// basically, a box to hide my PCB slop

const plateWidth = 62;
const plateHeight = 42;
const plateThickness = 3;
const cornerRadius = 3;

const wallHeight = 30;
const wallThickness = 2;

const holeDiameter = 2.2; // M2 clearance
const bossDiameter = 6;
const bossHeight = wallHeight;

const holeRadius = holeDiameter / 2;
const bossRadius = bossDiameter / 2;

const holeSpacingX = 54;
const holeSpacingY = 32;

function roundedRectSolid(width, height, thickness, radius, options = {}) {
  const { center = true } = options;
  const clampedRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  if (clampedRadius === 0) {
    return cube({ size: [width, height, thickness], center });
  }
  const offsetX = width / 2 - clampedRadius;
  const offsetY = height / 2 - clampedRadius;
  const corner = cylinder({ height: thickness, radius: clampedRadius, center: true });
  const corners = [
    [-offsetX, -offsetY],
    [offsetX, -offsetY],
    [-offsetX, offsetY],
    [offsetX, offsetY],
  ].map(([x, y]) => translate(corner, [x, y, 0]));
  const solid = hull(...corners);
  return center ? solid : translate(solid, [0, 0, thickness / 2]);
}

export function buildRadioEnclosure() {
  const base = roundedRectSolid(plateWidth, plateHeight, plateThickness, cornerRadius);

  const wallOuter = translate(
    roundedRectSolid(plateWidth, plateHeight, wallHeight, cornerRadius),
    [0, 0, plateThickness / 2 + wallHeight / 2]
  );

  const innerWidth = Math.max(plateWidth - 2 * wallThickness, plateWidth * 0.1);
  const innerHeight = Math.max(plateHeight - 2 * wallThickness, plateHeight * 0.1);
  const innerRadius = Math.max(cornerRadius - wallThickness, 0);

  const wallInner = translate(
    roundedRectSolid(innerWidth, innerHeight, wallHeight, innerRadius),
    [0, 0, plateThickness / 2 + wallHeight / 2]
  );

  const walls = difference(wallOuter, wallInner);

  const holeCenters = [
    [-holeSpacingX / 2, -holeSpacingY / 2],
    [holeSpacingX / 2, -holeSpacingY / 2],
    [-holeSpacingX / 2, holeSpacingY / 2],
    [holeSpacingX / 2, holeSpacingY / 2],
  ];

  const bossSolid = cylinder({ height: bossHeight, radius: bossRadius, center: true });
  const baseTop = plateThickness / 2;
  const bosses = holeCenters.map(([x, y]) =>
    translate(bossSolid, [x, y, baseTop + bossHeight / 2])
  );

  const body = union(base, walls, ...bosses);

  const bodyTop = baseTop + Math.max(wallHeight, bossHeight);
  const bodyBottom = -plateThickness / 2;
  const holeHeight = bodyTop - bodyBottom + 4;
  const holeMid = (bodyTop + bodyBottom) / 2;
  const throughHoleSolid = cylinder({ height: holeHeight, radius: holeRadius, center: true });
  const throughHoles = holeCenters.map(([x, y]) => translate(throughHoleSolid, [x, y, holeMid]));

  const holeCutout = union(...throughHoles);
  return difference(body, holeCutout);
}

export default buildRadioEnclosure;

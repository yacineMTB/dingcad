import buildDTSPCB from './library/DTSPCB.js';

const centerOnXY = (manifold) => {
  const bounds = boundingBox(manifold);
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  return translate(manifold, [-centerX, -centerY, 0]);
};

const roundedRectPrism = (width, height, depth, radius) => {
  const clampedRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  if (clampedRadius === 0) {
    return cube({ size: [width, height, depth], center: false });
  }
  const corner = cylinder({ height: depth, radius: clampedRadius, center: true });
  const offsets = [
    [-width / 2 + clampedRadius, -height / 2 + clampedRadius],
    [width / 2 - clampedRadius, -height / 2 + clampedRadius],
    [-width / 2 + clampedRadius, height / 2 - clampedRadius],
    [width / 2 - clampedRadius, height / 2 - clampedRadius],
  ];
  const corners = offsets.map(([x, y]) => translate(corner, [x, y, 0]));
  const roundedCenter = hull(...corners);
  return translate(roundedCenter, [width / 2, height / 2, depth / 2]);
};

const buildSteppedPrismScene = () => {
  const pcbWidth = 16;
  const pcbHeight = 13;
  const pcbThickness = 3.8;
  const topSectionBaseWidth = 6;
  const bottomSectionBaseWidth = 12;
  const widthScale = pcbWidth / (topSectionBaseWidth + bottomSectionBaseWidth);
  const topSectionWidth = topSectionBaseWidth * widthScale;
  const bottomSectionWidth = bottomSectionBaseWidth * widthScale;
  const bottomSectionThicknessFactor = 2;
  const behindScale = 1.35;

  const frontCornerRadius = 0;
  const pcbLeft = roundedRectPrism(topSectionWidth, pcbHeight, pcbThickness, frontCornerRadius);
  const pcbRight = translate(
    roundedRectPrism(bottomSectionWidth, pcbHeight, pcbThickness * bottomSectionThicknessFactor, frontCornerRadius),
    [topSectionWidth, 0, 0]
  );
  const behindSize = [pcbWidth * behindScale, pcbHeight * behindScale, pcbThickness * (behindScale + 0.1)];
  const behindDelta = [
    behindSize[0] - pcbWidth,
    behindSize[1] - pcbHeight,
    behindSize[2] - pcbThickness,
  ];
  const behindCornerRadius = 0;
  const pcbBehind = translate(
    roundedRectPrism(behindSize[0], behindSize[1], behindSize[2], behindCornerRadius),
    [-behindDelta[0] / 2, -behindDelta[1] / 2, -2 - behindDelta[2] / 2]
  );

  const centeredLeft = centerOnXY(pcbLeft);
  const centeredRight = centerOnXY(pcbRight);
  const centeredBehind = centerOnXY(pcbBehind);
  const centeredModule = centerOnXY(buildDTSPCB());

  const rotatedModule = rotate(centeredModule, [0, 90, 0]);
  const rotatedLeft = rotate(centeredLeft, [0, 90, 0]);
  const rotatedRight = rotate(centeredRight, [0, 90, 0]);
  const rotatedBehind = rotate(centeredBehind, [0, 90, 0]);
  const offsetLeft = translate(rotatedLeft, [1, 0, -1]);
  const offsetRight = translate(rotatedRight, [0.5, 0, -2.5]);
  const offsetBehind = translate(rotatedBehind, [3, 0, 1]);

  const leftCut = difference(offsetLeft, rotatedModule);
  const rightCut = difference(offsetRight, rotatedModule);
  const backCut = difference(offsetBehind, rotatedModule);
  const combined = union(leftCut, rightCut, backCut);

  const bounds = boundingBox(combined);
  return translate(combined, [
    -(bounds.min[0] + bounds.max[0]) / 2,
    -(bounds.min[1] + bounds.max[1]) / 2,
    -bounds.min[2],
  ]);
};

const buildTripleSteppedPrismScene = () => {
  const base = buildSteppedPrismScene();
  const radius = 11.5;
  const baseAngles = [0, 90, 180];
  const anglesDeg = baseAngles.map((angle) => angle - 90);

  const modules = anglesDeg.map((angle) => {
    const angleRad = (angle * Math.PI) / 180;
    const rotated = rotate(base, [0, 0, angle]);
    const offset = [Math.cos(angleRad) * radius, Math.sin(angleRad) * radius, 0];
    return translate(rotated, offset);
  });

  const trio = union(...modules);
  const stackedBase = rotate(base, [0, -90, 180]);
  const stackedBounds = boundingBox(stackedBase);
  const baseBounds = boundingBox(base);
  const stackSpacing = 4;
  const stackedOffsetX = -3;
  const stackedDrop = 5;
  const stacked = translate(stackedBase, [
    -(stackedBounds.min[0] + stackedBounds.max[0]) / 2 + stackedOffsetX,
    -(stackedBounds.min[1] + stackedBounds.max[1]) / 2,
    baseBounds.max[2] + stackSpacing - stackedBounds.min[2] - stackedDrop,
  ]);

  const quartet = union(trio, stacked);
  const trioBounds = boundingBox(quartet);
  return translate(quartet, [
    -(trioBounds.min[0] + trioBounds.max[0]) / 2,
    -(trioBounds.min[1] + trioBounds.max[1]) / 2,
    -trioBounds.min[2],
  ]);
};

export const buildTripleSteppedAssembly = () => {
  const baseScene = buildTripleSteppedPrismScene();
  const sceneScale = 1.01;
  return scale(baseScene, sceneScale);
};

export default buildTripleSteppedAssembly;

export function ifItFitsIsitsBox(manifold, padding = 2) {
  const bounds = boundingBox(manifold);

  const [minX, minY, minZ] = bounds.min;
  const [maxX, maxY, maxZ] = bounds.max;

  const extentX = maxX - minX;
  const extentY = maxY - minY;
  const extentZ = maxZ - minZ;

  const centerShiftX = -((minX + maxX) / 2);
  const centerShiftY = -((minY + maxY) / 2);

  const boxSize = [
    extentX + padding,
    extentY + padding,
    extentZ + padding,
  ];

  const padHalf = padding / 2;

  const centeredManifold = translate(manifold, [centerShiftX, centerShiftY, 0]);

  const box = translate(
    cube({
      size: boxSize,
      center: false,
    }),
    [minX + centerShiftX - padHalf, minY + centerShiftY - padHalf, minZ]
  );

  return difference(box, centeredManifold);
}

export function ifItFitsIsits(manifold, scaleFactor = 1.03) {
  if (scaleFactor <= 1) {
    throw new Error('scaleFactor must be greater than 1 to create clearance.');
  }

  const bounds = boundingBox(manifold);

  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const baseZ = bounds.min[2];

  const toOrigin = [-centerX, -centerY, -baseZ];
  const fromOrigin = [centerX, centerY, baseZ];

  const centered = translate(manifold, toOrigin);
  const scaled = scale(centered, [scaleFactor, scaleFactor, scaleFactor]);

  const cavity = difference(scaled, centered);

  return translate(cavity, fromOrigin);
}

export default ifItFitsIsits;

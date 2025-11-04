export function ifItFitsIsits(manifold, padding = 2) {
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

  const centeredManifold = translate(manifold, [centerShiftX, centerShiftY, 0]);

  const padHalf = padding / 2;

  const box = translate(
    cube({
      size: boxSize,
      center: false,
    }),
    [minX + centerShiftX - padHalf, minY + centerShiftY - padHalf, minZ]
  );

  return difference(box, centeredManifold);
}

export default ifItFitsIsits;

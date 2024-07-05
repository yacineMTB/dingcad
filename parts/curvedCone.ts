export const curvedCone = (
    manifoldTop: any,
    height: number,
    baseRadius: number,
    segments: number
) => {
  const { Manifold, CrossSection } = manifoldTop;
  const points = Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const r = baseRadius * (1 - t * t);
    return [r, height * t];
  });

  points.unshift([0, 0]);
  points.push([0, height]);

  const profile = new CrossSection([points]);
  return Manifold.revolve(profile);
};

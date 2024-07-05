import { curvedCone } from './curvedCone';

export const pointedLeg = (manifoldTop: any, params: {
  legRadius: number,
  legHeight: number,
  pointHeight: number,
  curvatureSegments: number
}) => {
  const { Manifold } = manifoldTop;
  const { legRadius, legHeight, pointHeight, curvatureSegments } = params;

  const curvedConeShape = curvedCone(manifoldTop, pointHeight, legRadius, curvatureSegments);
  const leg = Manifold.cylinder(legHeight, legRadius, legRadius, 32, false);
  const curvedConePositioned = curvedConeShape.translate(0, 0, legHeight);

  return Manifold.union(curvedConePositioned, leg);
};

import { ManifoldToplevel } from './manifold_lib//built/manifold';
import { pointedLeg} from "./parts/pointedLeg";


export const mainAssembly = (manifoldTop: any) => {
  const { Manifold, CrossSection } = manifoldTop as ManifoldToplevel;

  const legDistance = 50;
  const legRadius = 3;
  const legHeight = 100;
  const pointHeight = 40;
  const curvatureSegments = 10;

  const ringOuterRadius = legDistance / 2 + legRadius;
  const ringInnerRadius = legDistance / 2 - legRadius / 10;
  const ringThickness = legRadius;


  const innerRing = Manifold.cylinder(ringThickness, ringInnerRadius, ringInnerRadius, 64, false);

  const createHalfLeg = () => {
    const leg = pointedLeg(manifoldTop, {
      legRadius,
      legHeight,
      pointHeight,
      curvatureSegments
    });
    return leg.splitByPlane([0, 1, 0], 0)[0];
  };

  const createRing = () => {
    const outerRing = Manifold.cylinder(ringThickness, ringOuterRadius, ringOuterRadius, 64, false);
    return outerRing.subtract(innerRing).rotate(270, 0, 0);
  };

  const leftLeg = createHalfLeg().translate(-legDistance / 2, 0, 0).subtract(Manifold.cube());
  const rightLeg = createHalfLeg().translate(legDistance / 2, 0, 0);
  const ring = createRing();
  return Manifold.union([
    leftLeg,
    rightLeg,
    ring
  ]).subtract(
    innerRing.rotate(270, 0, 0)
  );
};


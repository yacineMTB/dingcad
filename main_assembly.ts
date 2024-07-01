import { ManifoldToplevel } from './manifold_lib//built/manifold';
import { cube } from './parts/cube';

export const mainAssembly = (manifold: ManifoldToplevel) => {
  const { cylinder, union } = manifold.Manifold;
  const legHeight = 100;
  const legRadius = 10;
  const leg = cylinder(legHeight, legRadius);
  const nextLeg = leg.translate(100);
  return union(cube(manifold), union(leg, nextLeg));
}


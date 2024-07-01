import { ManifoldToplevel } from '../manifold_lib//built/manifold';
export const cube = (manifold: ManifoldToplevel) => {
  const { cube } = manifold.Manifold;
  return cube([10, 10, 10]);
}

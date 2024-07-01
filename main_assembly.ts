import { ManifoldToplevel } from './manifold_lib//built/manifold';

export const mainAssembly = (manifold: ManifoldToplevel) => {
  const { cube, cylinder, union } = manifold.Manifold;

  const tableTopWidth = 120;
  const tableTopDepth = 80;
  const tableTopHeight = 5;
  const legHeight = 70;
  const legRadius = 3;

  const tableTop = cube([tableTopWidth, tableTopDepth, tableTopHeight]);


  const leg = cylinder(legHeight, legRadius);

  const leg1 = leg.translate([5, 5, -legHeight]);
  const leg2 = leg.translate([tableTopWidth - 5, 5, -legHeight]);
  const leg3 = leg.translate([5, tableTopDepth - 5, -legHeight]);
  const leg4 = leg.translate([tableTopWidth - 5, tableTopDepth - 5, -legHeight]);

  const legs = [leg1, leg2, leg3, leg4];
  let assembly = tableTop;
  for (const leg of legs) {
    assembly = union(assembly, leg);
  }

  return assembly;
}


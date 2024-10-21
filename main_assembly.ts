import { ManifoldToplevel, Vec3, Vec2, Manifold, CrossSection } from './manifold_lib/built/manifold';
import { color , green, blue } from './parts/colorgradient';
import { createNode } from './parts/createGLTFNode';

export const mainAssembly = (m: ManifoldToplevel) => {
  const { Manifold, CrossSection } = m;
  const cornerRadius=2;
  const wall = (CrossSection.square([150, 5], false)
    .translate([4, 0])).offset(-cornerRadius, 'Round', undefined, 64)
                              .offset(cornerRadius, 'Round', undefined, 64);
;
  const secondWall = wall.mirror([1, 0]);
  let walls = secondWall.add(wall)
  walls = walls;
  const fourWalls = walls.add(walls.rotate(90).translate(5/2, 5/2))
 

  let connector = color(
      CrossSection.square([30, 10])
        .translate(-5)
        .add(
          CrossSection.square([30, 10])
            .rotate(90)
            .translate([15, -10])
        )
      .extrude(100)
  )
    .translate(-10, -2.5)
    .subtract(fourWalls.extrude(96))
    // .add(green(walls.extrude(47)))

  return connector
    .add(color(wall.translate(-50, -50).extrude(96)))
};

// 320 = n * 2 + 8
// 160 = n + 8
// n = 160 - 8 = 160-8=16
//

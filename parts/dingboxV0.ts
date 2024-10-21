
import { ManifoldToplevel, Vec3, Vec2, Manifold, CrossSection } from './manifold_lib/built/manifold';
import { applyColorGradient, green, blue } from './parts/colorgradient';
import { createNode } from './parts/createGLTFNode';

const createOLEDFace = (m: ManifoldToplevel, params: {
  oledWidth: number,
  oledHeight: number,
  oledFrontDepth: number,
  displayCableWidth: number,
  displayCableLift: number,
  boxWidth: number,
  x: number,
  z: number,
}) => {
  const { Manifold } = m;
  const { x, z, oledWidth, oledHeight, oledFrontDepth, displayCableWidth, displayCableLift, boxWidth } = params;

  const screenHole = Manifold.cube([oledWidth, oledFrontDepth, oledHeight], true)
    .translate([x, (boxWidth/2)-oledFrontDepth/2, z]);

  const cableHole = Manifold.cube([displayCableWidth, oledFrontDepth, oledHeight], true)
    .translate([x, (boxWidth/2)-oledFrontDepth/2, z+displayCableLift]);


  const faceDepth = 10;

  const restOfHole = Manifold.cube([oledWidth, faceDepth, 28], true)
    .translate([x, (boxWidth/2)-faceDepth/2-oledFrontDepth, z]);


  return Manifold.union([green(screenHole), green(cableHole), blue(restOfHole)]);
}

const createHollowBox = (manifold: ManifoldToplevel, outerDimensions: Vec3, wallThickness: number, cornerRadius: number, floorHeight: number): Manifold => {
  const { CrossSection } = manifold;
  let outerPolygon = CrossSection.square([outerDimensions[0], outerDimensions[1]], true);
  const circularSegments = 64;
  outerPolygon = outerPolygon.offset(-cornerRadius, 'Round', undefined, circularSegments)
                              .offset(cornerRadius, 'Round', undefined, circularSegments);
  const innerDimensions: Vec2 = [
    outerDimensions[0] - 2 * wallThickness,
    outerDimensions[1] - 2 * wallThickness
  ];
  let innerPolygon = CrossSection.square(innerDimensions, true);
  innerPolygon = innerPolygon.offset(-cornerRadius / 2, 'Round', undefined, circularSegments)
                              .offset(cornerRadius / 2, 'Round', undefined, circularSegments);

  const hollowShape = outerPolygon.subtract(innerPolygon);
  const solidBox = hollowShape.extrude(outerDimensions[2], undefined, undefined, undefined, true);

  const floor = outerPolygon 
    .extrude(floorHeight, undefined, undefined, undefined, true)
    .translate([0, 0, (-outerDimensions[2] / 2) + floorHeight/2]);
  floor;

  return solidBox
    .add(floor)
    .translate([0,0,outerDimensions[2]/2]);
}

export const makeTubes_ = (manifoldTop: ManifoldToplevel) => {
  const { Manifold, CrossSection } = manifoldTop;
  const majorRadius = 8;
  const minorRadius = 1.5;
  const arcAngle = 180;
  const segments = 64;
  const circle = CrossSection.circle(minorRadius).translate([majorRadius, 0]);
  const fullCylinder = Manifold.revolve(circle, segments, arcAngle);
  const cylinder = circle.extrude(10).rotate(90, 0, 90).translate(0);

  const normal: Vec3 = [1, 0, 0];
  const originOffset = 0;
  let x = fullCylinder.trimByPlane(normal, originOffset)
  const y = x.mirror(normal)

  x = x.rotate(90, 0, 0).translate([10, 8, -8])
  return x.add(y).add(cylinder);
};


export const makeTubes = (manifoldTop: ManifoldToplevel) => {
  const { Manifold, CrossSection } = manifoldTop;
  const majorRadius = 4;
  const minorRadius = 1.5;
  const arcAngle = 90;
  const segments = 64;
  const circle = CrossSection.circle(minorRadius).translate([majorRadius, 0]);
  const fullCylinder = Manifold.revolve(circle, segments, arcAngle);
  return fullCylinder.rotate(90, 0, 90);
};

export const mainAssembly = (m: ManifoldToplevel) => {
  const wallThickness = 4;
  const boxWidth = 20+wallThickness;
  const boxLength = 190+wallThickness;
  const boxHeight = 90+wallThickness;

  const outerDimensions: Vec3 = [boxLength, boxWidth, boxHeight];
  const cornerRadius = 10;
  const floorHeight = 10;

  const box = createHollowBox(m, outerDimensions, wallThickness, cornerRadius, floorHeight);

  const oledFrontDepth = 2;
  const oledWidth = 27;
  const oledHeight = 19;
  const displayCableLift = 4.5;
  const displayCableWidth = 15;
  const oledFace = createOLEDFace(m, {
    oledWidth,
    oledHeight,
    oledFrontDepth,
    displayCableWidth,
    displayCableLift,
    boxWidth, z: 50, x: 50
  });

  let cable = blue(makeTubes(m));
  cable = cable
    .rotate(270, 0, 0)
    .translate([0, -boxWidth/2-2, boxHeight]);
  let secondCable = cable.mirror([-1, 0, 0]).translate([-4, 0, 0]);
  const cables = secondCable.add(cable).translate([-boxHeight/3 * 2, 0, 0]);

  const coloredBox = applyColorGradient(box, outerDimensions);
  let assembly = coloredBox.subtract(green(oledFace));
  assembly = assembly.subtract(cables)


  return createNode(assembly);
};





import buildTripleSteppedAssembly from './TripleSteppedPrism.js';

const SLEEVE_CONFIG = {
  width: 8,
  height: 19,
  length: 8,
  wall: 0.6,
  rotation: [0, 0, 0],
  translation: [-13, 0, 4],
};

const SLEEVE_CONFIG_2 = {
  width: 6.7 + 1.1,
  height: 15.5 + 1.1,
  length: 8,
  wall: 0.6,
  rotation: [0, 0, 0],
  translation: [-13 - 7.4, 0, 4],
};

const buildSleeve = ({
  width,
  height,
  length,
  wall,
  rotation = [0, 0, 0],
  translation = [0, 0, 0],
}) => {
  const outerSize = [width, height, length];
  const innerSize = [width - 2 * wall, height - 2 * wall, length];
  if (innerSize[0] <= 0 || innerSize[1] <= 0 || length <= 0) {
    throw new Error('Sleeve dimensions invalid: wall thickness too large or length non-positive.');
  }

  const outer = cube({ size: outerSize, center: true });
  const inner = cube({ size: innerSize, center: true });
  const sleeveBody = difference(outer, inner);
  return translate(rotate(sleeveBody, rotation), translation);
};

export const buildSleevedTripleAssembly = () => {
  const baseScene = buildTripleSteppedAssembly();
  const sleeve = buildSleeve(SLEEVE_CONFIG);
  const sleeve2 = buildSleeve(SLEEVE_CONFIG_2);
  return union(baseScene, sleeve, sleeve2);
};

export default buildSleevedTripleAssembly;

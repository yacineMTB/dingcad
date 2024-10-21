import { Manifold } from '../manifold_lib/built/manifold';
import { GLTFNode } from '../manifold_lib/worker';

export const createNode = (shape: Manifold): GLTFNode => {
  const node = new GLTFNode();
  node.manifold = shape;
  node.material = {
    baseColorFactor: [1, 1, 1],
    metallic: 0.5,
    roughness: 0.5,
    attributes: ['COLOR_0']
  };
  return node;
};

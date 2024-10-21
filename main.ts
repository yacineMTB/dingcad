//llmWhen this script is run, the manifold definition in 
// main_assembly.ts is saved to output.glb
// you can run this with npm run cad, which will 
// render out output.glb on autosave

import fs from 'fs';
import path from 'path';
import { exportModels } from './manifold_lib/worker';
import Module from './manifold_lib/built/manifold';
import { mainAssembly } from './main_assembly';
import { createNode } from './parts/createGLTFNode';

export const manifoldModule = await Module();
manifoldModule.setup();

const defaults = {
  roughness: 0.1,
  metallic: 0,
  baseColorFactor: [0.5, 0.5, 0],
  alpha: 1,
  unlit: false,
  animationLength: 1,
  animationMode: 'loop'
};

async function runAndSave(fn: any) {
  const gltfNode = createNode(fn(manifoldModule));
  const result = await exportModels(defaults as any, gltfNode.manifold);

  if (result) {
    const response = await fetch(result.glbURL);
    const buffer = await response.arrayBuffer();
    const outputPath = path.join('./', `out.glb`);
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    console.log(`out.glb updated ${outputPath}`);
  }
}

runAndSave(mainAssembly);

const ensureLoadMeshAvailable = () => {
  if (typeof loadMesh !== 'function') {
    throw new Error('loadMesh binding is not available; rebuild the viewer with mesh import support.');
  }
};

const centerOnOrigin = (manifold) => {
  const bounds = boundingBox(manifold);
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cy = (bounds.min[1] + bounds.max[1]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  return translate(manifold, [-cx, -cy, -cz]);
};

export const buildSeeedCase = () => {
  ensureLoadMeshAvailable();
  const topShell = loadMesh('assemblies/library/models/seedcase/seeed-top.stl', true);
  const bottomShell = loadMesh('assemblies/library/models/seedcase/seeed-bottom.stl', true);
  const assembled = union(topShell, bottomShell);
  return centerOnOrigin(assembled);
};

export default buildSeeedCase;

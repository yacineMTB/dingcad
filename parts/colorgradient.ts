import { ManifoldToplevel, Vec3, Manifold } from '../manifold_lib/built/manifold';
export const color = (shape: Manifold, dimensions?: Vec3): Manifold => {
  const [width, height, depth] = dimensions || [1, 1, 1];
  
  const colorGradient = (color: number[], pos: Vec3) => {
    const tx = (pos[0] + width/2) / width;
    const ty = (pos[1] + height/2) / height;
    const tz = (pos[2] + depth/2) / depth;
    color[0] = tx;
    color[1] = ty;
    color[2] = tz;
  };

  return shape.setProperties(3, colorGradient);
};

export const green = (shape: Manifold): Manifold => {
  const [width, height, depth] =  [100, 100, 100];
  
  const greenishGradient = (color: number[], pos: Vec3) => {
    const tx = (pos[0] + width/2) / width;
    const ty = (pos[1] + height/2) / height;
    const tz = (pos[2] + depth/2) / depth;
    
    // bias towards green
    color[0] = 0.2 + 0.3 * tx; // red component
    color[1] = 0.5 + 0.5 * ty; // green component
    color[2] = 0.2 + 0.3 * tz; // blue component
  };

  return shape.setProperties(3, greenishGradient);
};

export const blue = (shape: Manifold): Manifold => {
  const [width, height, depth] = [100, 100, 100];
  
  const bluishGradient = (color: number[], pos: Vec3) => {
    const tx = (pos[0] + width/2) / width;
    const ty = (pos[1] + height/2) / height;
    const tz = (pos[2] + depth/2) / depth;
    
    // bias towards blue
    color[0] = 0.2 + 0.3 * tx; // red component
    color[1] = 0.2 + 0.3 * ty; // green component
    color[2] = 0.5 + 0.5 * tz; // blue component
  };

  return shape.setProperties(3, bluishGradient);
};

# Color API Design

## JavaScript API

### Simple usage with helper function:
```javascript
// Create colored objects
const redBox = withColor(cube({size: [10, 10, 10]}), [0.8, 0.2, 0.2]);
const blueSphere = withColor(sphere({radius: 5}), [0.2, 0.4, 0.9]);
const greenCylinder = withColor(cylinder({height: 15, radius: 3}), [0.3, 0.7, 0.3]);

// Export as array
export const scene = [redBox, blueSphere, greenCylinder];
```

### Backward compatibility:
```javascript
// Single manifold without color - uses default gray
export const scene = cube({size: [10, 10, 10]});
```

### Alternative: Object notation (also supported):
```javascript
export const scene = [
  {geometry: cube({size: [10, 10, 10]}), color: [0.8, 0.2, 0.2]},
  {geometry: sphere({radius: 5}), color: [0.2, 0.4, 0.9]}
];
```

## C++ Implementation

### Data structures:
```cpp
struct ColoredObject {
  std::shared_ptr<manifold::Manifold> geometry;
  Color color;  // raylib Color struct
};

struct SceneData {
  std::vector<ColoredObject> objects;
};
```

### Rendering:
- Each object gets its own color passed to shader
- Update `baseColor` uniform per object during draw loop

## Color format:
- RGB values from 0.0 to 1.0
- Alpha/transparency not supported initially (can add later)

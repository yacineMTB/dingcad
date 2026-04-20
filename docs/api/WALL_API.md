# Wall() API Documentation

The `Wall()` primitive creates architectural walls with realistic construction details.

## Basic Usage

```javascript
const wall = Wall({
  start: [0, 0],      // Start position [x, y] in mm
  end: [3000, 0],     // End position [x, y] in mm
  height: 2400        // Wall height in mm
});
```

## Construction Types

### 1. Solid Wall (default)

Simple solid wall - useful for concrete, brick, or placeholder geometry.

```javascript
const concreteWall = Wall({
  start: [0, 0],
  end: [5000, 0],
  height: 2400,
  thickness: 200,              // 200mm concrete wall
  construction: "solid"
});
```

### 2. Stick-Frame Construction

Wood-framed wall with studs, plates, and optional sheathing - common in residential construction.

```javascript
const framedWall = Wall({
  start: [0, 0],
  end: [3000, 0],
  height: 2400,
  construction: "stickFrame",

  // Stud configuration
  studSize: [48, 98],          // [width, depth] in mm (2x4 lumber)
  studSpacing: 400,            // 400mm on center (16" OC)

  // Plates
  bottomPlateHeight: 48,       // Bottom plate thickness
  topPlateHeight: 48,          // Top plate thickness

  // Sheathing
  includeSheathing: true,      // Add OSB/plywood sheathing
  sheathingThickness: 12       // 12mm OSB
});
```

## Parameters Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start` | `[number, number]` | `[0, 0]` | Start position [x, y] in mm |
| `end` | `[number, number]` | `[1000, 0]` | End position [x, y] in mm |
| `height` | `number` | `2000` | Wall height in mm |
| `thickness` | `number` | `98` | Wall thickness (solid) or depth (framed) in mm |
| `construction` | `string` | `"solid"` | Construction type: `"solid"` or `"stickFrame"` |

### Stick-Frame Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `studSize` | `[number, number]` | `[48, 98]` | Stud dimensions [width, depth] in mm |
| `studSpacing` | `number` | `400` | Spacing between stud centers in mm |
| `bottomPlateHeight` | `number` | `48` | Bottom plate thickness in mm |
| `topPlateHeight` | `number` | `48` | Top plate thickness in mm |
| `includeSheathing` | `boolean` | `false` | Whether to include sheathing panels |
| `sheathingThickness` | `number` | `12` | Sheathing thickness in mm |

## Common Configurations

### 2x4 Wall (16" OC)
Standard residential wall - common in North America
```javascript
Wall({
  start: [0, 0],
  end: [3000, 0],
  height: 2400,
  construction: "stickFrame",
  studSize: [48, 98],     // 2x4 lumber (actual: 38mm x 89mm, nominal: 48x98)
  studSpacing: 400,       // 16" on center (406.4mm)
  includeSheathing: true
});
```

### 2x6 Wall (24" OC)
Thicker wall for better insulation
```javascript
Wall({
  start: [0, 0],
  end: [3000, 0],
  height: 2400,
  construction: "stickFrame",
  studSize: [48, 148],    // 2x6 lumber (actual: 38mm x 140mm)
  studSpacing: 600,       // 24" on center (609.6mm)
  includeSheathing: true,
  sheathingThickness: 12
});
```

### Concrete Block Wall
```javascript
Wall({
  start: [0, 0],
  end: [5000, 0],
  height: 2400,
  thickness: 200,         // 200mm (8") concrete block
  construction: "solid"
});
```

## Building a Room

```javascript
const DISPLAY_SCALE = 0.01;  // Scale for viewing

// Room dimensions
const length = 4000;
const width = 3000;
const height = 2400;

// Create four walls
const frontWall = Wall({
  start: [0, 0],
  end: [length, 0],
  height: height,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: true
});

const backWall = Wall({
  start: [0, width],
  end: [length, width],
  height: height,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: true
});

const leftWall = Wall({
  start: [0, 0],
  end: [0, width],
  height: height,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: true
});

const rightWall = Wall({
  start: [length, 0],
  end: [length, width],
  height: height,
  construction: "stickFrame",
  studSize: [48, 98],
  studSpacing: 400,
  includeSheathing: true
});

// Color and scale
const WOOD_COLOR = [0.72, 0.57, 0.38];
export const scene = [
  withColor(scale(frontWall, DISPLAY_SCALE), WOOD_COLOR),
  withColor(scale(backWall, DISPLAY_SCALE), WOOD_COLOR),
  withColor(scale(leftWall, DISPLAY_SCALE), WOOD_COLOR),
  withColor(scale(rightWall, DISPLAY_SCALE), WOOD_COLOR)
];
```

## Tips

1. **Units**: All dimensions are in millimeters
2. **Coordinate System**: Z-axis is up, X-Y is the floor plane
3. **Wall Alignment**: Walls are created along the line from start to end
4. **Stud Spacing**: Common values are 400mm (16" OC) or 600mm (24" OC)
5. **Visualization**: Use `DISPLAY_SCALE = 0.01` to scale down for viewing
6. **Sheathing**: Add sheathing for exterior walls, skip for interior to see framing

## Future Enhancements

Coming soon:
- Header beams over openings
- Door and window rough openings
- Electrical wiring channels
- Insulation representation
- Metal stud framing
- Masonry construction (brick, CMU)
- Load-bearing vs. partition walls

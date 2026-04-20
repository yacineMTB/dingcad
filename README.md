## Helscoop

*Nae talosi. Muuta. Rakenna.* (See your house. Change it. Build.)

Helscoop is a live reloading 3D CAD viewer, a replacement for openscad. Try `./run.sh` and then updating `scene.js`.

Dependencies: raylib, manifoldcad, and quickjs. Ask an LLM how to set up raylib on your system. For quickjs and manifoldcad:

```
git submodule update --init --recursive
```

This repository is mostly autonomously written by an LLM.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| P | Toggle PBR / Toon rendering |
| T | Toggle parameters panel |
| M | Toggle materials panel |
| H | Toggle thermal view |
| F3 | Toggle structural panel |
| F4 | Toggle assembly panel |
| F9 | Cycle debug views |
| R | Reload scene |
| Space | Reset camera |
| WASD/QE | Move camera |
| Ctrl+E | Export STL |
| Ctrl+O | Export OBJ |
| Ctrl+I | Export IFC |

### Parametric Controls

Add `@param` annotations above `const` declarations to create UI sliders:

```javascript
// @param wall_height "Dimensions" Wall height in mm (1500-3000)
const wall_height = 2400;
```

Format: `// @param <name> "<section>" <label> (<min>-<max>)`

### Scene API

Scene files are ES modules exporting `scene` (geometry array) and optionally `displayScale`.

**Coordinate system:** X = width (left-right), Y = depth (front-back), Z = height (up).

```javascript
// Primitives
cube([width, depth, height])            // or cube({size: [w,d,h], center: true})
sphere(radius)                          // or sphere({radius: 10})
cylinder(height, radius)                // or cylinder({height, radius, radiusTop, segments, center})
torus(majorRadius, minorRadius)         // or torus({majorRadius, minorRadius, segments, minorSegments})
Wall({start: [x,z], end: [x,z], height: h, thickness: t})

// Boolean operations (variadic or array)
union(a, b, c)                          // or union([a, b, c])
difference(base, cutout)
intersection(a, b)

// Transforms
translate(geometry, [x, y, z])
rotate(geometry, [degX, degY, degZ])
scale(geometry, factor)                 // or scale(geometry, [sx, sy, sz])
mirror(geometry, [nx, ny, nz])

// Extrusion & revolution
extrude(polygon, height)                // or extrude(polygon, {height, twistDegrees, scaleTop, divisions})
revolve(polygon, segments)              // or revolve(polygon, {segments, degrees}), defaults: 360°

// Patterns
linearPattern(geometry, count, [dx, dy, dz])   // count copies offset by [dx,dy,dz]
circularPattern(geometry, count)                // count copies rotated around Z axis

// Smoothing & refinement
smooth(geometry, tolerance?)            // subdivide smooth (default tolerance=0.5)
hull(a, b, c)                          // convex hull of geometries

// SDF / implicit surfaces
levelSet({sdf, bounds, edgeLength})     // sdf: ([x,y,z]) => number, bounds: {min, max}
trimByPlane(geometry, [nx,ny,nz], offset)

// 2D polygon primitives & operations
circle2D(radius, segments?)                // polygon array for a circle (default 32 segments)
rect2D(width, height, center?)             // polygon array for a rectangle
offset2D(polygon, delta)                   // offset polygon outward (+) or inward (-)
offset2D(polygon, {delta, join, segments}) // join: "round"|"square"|"miter"|"bevel"
hull2D(points)                             // convex hull of [[x,y], ...] points
hull2D(polygon1, polygon2, ...)            // convex hull wrapping multiple polygons
star2D(outerRadius, innerRadius, points)   // star polygon (5=pentagram, 6=hexagram, etc.)
ellipse2D(radiusX, radiusY, segments?)     // ellipse polygon
slot2D(length, width, segments?)           // stadium/slot shape (rect with semicircle ends)
arc2D(radius, startDeg, endDeg, width, segments?) // thick arc segment band

// Deformation & splitting
warp(geometry, ([x,y,z]) => [x',y',z'])  // per-vertex coordinate transform
splitByPlane(geometry, [nx,ny,nz], offset)  // returns [inside, outside]
split(geometry, cutter)                    // returns [inside, outside]

// Color & materials
withColor(geometry, [r, g, b])          // r,g,b in 0-1 range
withPBR(geometry, {color, roughness, metallic})  // PBR material properties
withMaterial(geometry, "material_id")   // references materials/materials.json

// Queries
volume(geometry)
surfaceArea(geometry)
boundingBox(geometry)                   // returns {min, max}
```

See `examples/` for parametric examples:

| Example | Showcases |
|---------|-----------|
| table | Multi-part assembly, oak PBR |
| bookshelf | linearPattern, three-material walnut/plywood |
| vase | Twisted extrude, hollow boolean, glazed ceramic PBR |
| bowl | revolve + smooth, cherry wood PBR |
| chess | smooth() for organic shapes, ivory PBR |
| gear | circularPattern, steel metallic PBR |
| bolt | Hex head + threads, zinc metallic PBR |
| gyroid | levelSet SDF, lattice structures |
| lamp | Multi-material: brass metal + cream matte shade |
| tower | warp() twist deformation, refineToLength |
| showroom | Multi-object PBR: revolve, warp, boolean, patterns |
| bracket | circle2D, rect2D, offset2D, rounded corners, bolt holes |
| badge | hull2D, offset2D, multi-material, boolean cutouts |
| medallion | arc2D, star2D, ellipse2D, decorative relief patterns |
| wrench | hull2D, arc2D, slot2D, parametric open-end wrench |
| helscoop | Full architecture: walls, roof, textures, assembly |

### Render Mode

```
./build/viewer/helscoop_viewer --render scene.js output.png --size 1280 720
./build/viewer/helscoop_viewer --help
```

Background modes: `--background white` (clean studio), `--background transparent` (alpha channel for compositing).

`--supersample 2` renders at 2x resolution for smoother edges. Camera presets: `--camera front|back|left|right|top|bottom|iso|three-quarter`.

Turntable animation: `--turntable 36` renders 36 frames rotating 360°.

Run `--help` for the full list of camera, filtering, and render options.

Architecture visual doc pipeline:

```
./scripts/generate-architecture-doc.sh
```

See `docs/ARCHITECTURE_DOC_PIPELINE.md` for shot presets and output structure.

# Architecture Overview

This document provides an architectural overview of the DingCAD project for AI and human understanding.

## Project Structure

```
dingcad/
├── CMakeLists.txt          # Root CMake configuration
├── Makefile                # Build automation
├── README.md               # Project overview
├── API.md                  # JavaScript API reference
├── run.sh                  # Quick run script
├── scene.js                # Default scene file (user-editable)
│
├── docs/                   # Documentation
│   ├── architecture.md     # This file
│   ├── build-instructions.md
│   └── issues-fixed.md
│
├── library/                # Example JavaScript libraries
│   ├── DTSPCB.js
│   ├── radio_enclosure.js
│   └── xiao_esp32c3.js
│
├── vendor/                 # Git submodules (external dependencies)
│   ├── manifold/          # Manifold CAD library (C++)
│   └── quickjs/           # QuickJS JavaScript engine (C)
│
└── viewer/                 # Main application
    ├── CMakeLists.txt      # Viewer build configuration
    ├── main.cpp            # Application entry point
    ├── js_bindings.cpp     # JavaScript API bindings
    ├── js_bindings.h       # JavaScript API header
    └── scene.js            # Default scene (if not in root)
```

## Core Components

### 1. Viewer Application (`viewer/`)

**Language:** C++17

**Purpose:** Main application that provides:
- 3D rendering using Raylib
- JavaScript execution environment
- Live reloading of scene files
- File watching for automatic reloads
- STL export functionality

**Key Files:**
- `main.cpp`: Application entry point, rendering loop, file watching
- `js_bindings.cpp`: JavaScript API bindings to Manifold library
- `js_bindings.h`: Header for JavaScript bindings

### 2. Manifold Library (`vendor/manifold/`)

**Language:** C++

**Purpose:** 3D geometry library providing:
- Solid modeling operations
- Boolean operations (union, difference, intersection)
- Mesh generation and manipulation
- Polygon operations
- Mesh I/O

**Usage:** Statically linked as a CMake subdirectory

**Key Features:**
- Robust boolean operations
- Parallel processing support (TBB)
- Mesh property support
- Cross-section operations

### 3. QuickJS Engine (`vendor/quickjs/`)

**Language:** C

**Purpose:** Lightweight JavaScript engine providing:
- JavaScript execution
- Module loading
- File system module loader
- ECMAScript 2020 support

**Usage:** Statically linked as a library (`dingcad_quickjs`)

**Key Features:**
- Small footprint
- Fast execution
- Module system support
- Custom module loader for file system access

### 4. Raylib (`external dependency`)

**Language:** C

**Purpose:** Graphics library providing:
- 3D rendering
- Window management
- Input handling
- Camera controls

**Usage:** Linked via CMake `find_package(raylib)`

## Data Flow

```
User edits scene.js
    ↓
File watcher detects change
    ↓
QuickJS loads and executes scene.js
    ↓
JavaScript calls manifold API functions
    ↓
C++ bindings convert JS values to C++ types
    ↓
Manifold library performs operations
    ↓
Result returned as Manifold object
    ↓
Mesh extracted from Manifold
    ↓
Mesh converted to Raylib Model
    ↓
Raylib renders Model to screen
```

## JavaScript API

The JavaScript API is exposed through global functions in the QuickJS context.

### Geometry Primitives
- `cube(options)` - Create a cube
- `sphere(options)` - Create a sphere
- `cylinder(options)` - Create a cylinder
- `tetrahedron()` - Create a tetrahedron

### Boolean Operations
- `union(...manifolds)` - Union multiple manifolds
- `difference(...manifolds)` - Subtract manifolds
- `intersection(...manifolds)` - Intersect manifolds
- `boolean(a, b, op)` - Generic boolean operation
- `batchBoolean(op, manifolds)` - Batch boolean operation

### Transformations
- `translate(manifold, [x, y, z])` - Translate
- `scale(manifold, factor|[sx, sy, sz])` - Scale
- `rotate(manifold, [rx, ry, rz])` - Rotate
- `mirror(manifold, [nx, ny, nz])` - Mirror
- `transform(manifold, matrix)` - Matrix transform

### Advanced Operations
- `extrude(polygons, options)` - Extrude polygons
- `revolve(polygons, options)` - Revolve polygons
- `hull(...manifolds)` - Convex hull
- `hullPoints([[x,y,z],...])` - Hull from points
- `slice(manifold, height?)` - Slice at height
- `project(manifold)` - Project to 2D
- `levelSet(options)` - Level set from SDF function
- `loadMesh(path)` - Load mesh from file

### Mesh Operations
- `simplify(manifold, tolerance?)` - Simplify mesh
- `refine(manifold, iterations)` - Subdivide mesh
- `refineToLength(manifold, length)` - Refine to target length
- `refineToTolerance(manifold, tolerance)` - Refine to tolerance

### Properties and Analysis
- `surfaceArea(manifold)` - Calculate surface area
- `volume(manifold)` - Calculate volume
- `boundingBox(manifold)` - Get bounding box
- `numTriangles(manifold)` - Triangle count
- `numVertices(manifold)` - Vertex count
- `numEdges(manifold)` - Edge count
- `genus(manifold)` - Calculate genus
- `isEmpty(manifold)` - Check if empty
- `status(manifold)` - Get error status

### Scene Export

The final scene must be assigned to the `scene` variable:

```javascript
scene = cube({size: [10, 10, 10]});
```

## Build System

### CMake Configuration

**Root CMakeLists.txt:**
- Sets C++17 standard
- Configures TBB (Threading Building Blocks) detection
- Adds vendor subdirectories (manifold, quickjs)
- Configures manifold build options

**Viewer CMakeLists.txt:**
- Finds Raylib dependency
- Builds QuickJS as static library
- Builds viewer executable
- Links dependencies

### Makefile

Provides convenient commands for:
- Submodule initialization
- Dependency checking
- CMake configuration
- Building
- Running
- Cleaning

## Memory Management

### C++ Side
- Uses `std::shared_ptr<manifold::Manifold>` for manifold objects
- Raylib handles its own memory management
- QuickJS manages JavaScript values

### JavaScript Side
- Manifold objects are wrapped in QuickJS objects
- Finalizer automatically cleans up when JS object is garbage collected
- Module loader tracks file dependencies

## Threading

- **Manifold operations:** Can use TBB for parallel processing
- **Rendering:** Single-threaded (Raylib is not thread-safe)
- **File watching:** Synchronous check in main loop

## File Watching

The application watches for changes to:
- `scene.js` (or specified scene file)
- Any JavaScript modules imported by the scene

When a file changes:
1. File timestamp is compared
2. Scene is reloaded
3. Dependencies are re-tracked
4. New mesh is generated and displayed

## Export Functionality

Press 'P' key to export current scene to STL:
- Default location: `~/Downloads/ding.stl`
- Binary STL format
- Includes all triangles with normals

## Error Handling

### JavaScript Errors
- Caught and displayed in status message
- Stack traces shown in console
- Scene continues to show previous valid mesh

### C++ Errors
- Exceptions caught and converted to JavaScript errors
- File I/O errors handled gracefully
- Mesh validation errors reported

## Platform Support

### macOS
- ✅ Full support
- Homebrew dependencies
- System font detection

### Linux
- ✅ Full support
- Standard package managers
- System font detection

### Windows
- ⚠️ Partial support
- Requires manual dependency setup
- vcpkg recommended

## Performance Considerations

### Rendering
- Raylib uses hardware acceleration when available
- Mesh is chunked if >65k vertices (OpenGL limitation)
- MSAA 4x enabled for smooth edges

### JavaScript Execution
- QuickJS is optimized for fast startup
- Module compilation cached
- No JIT compilation overhead

### Mesh Operations
- Manifold operations can be CPU-intensive
- TBB parallelization helps with complex operations
- Large meshes may cause frame rate drops

## Extension Points

### Adding New JavaScript Functions

1. Add C++ function in `js_bindings.cpp`:
```cpp
JSValue JsNewFunction(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  // Implementation
  return WrapManifold(ctx, result);
}
```

2. Register in `RegisterBindingsInternal()`:
```cpp
JS_SetPropertyStr(ctx, global, "newFunction", 
  JS_NewCFunction(ctx, JsNewFunction, "newFunction", 1));
```

### Adding New Geometry Primitives

Follow the pattern in `JsCube()`, `JsSphere()`, etc.:
1. Parse JavaScript arguments
2. Create manifold using Manifold API
3. Wrap in `WrapManifold()` and return

### Custom Module Loaders

The module loader (`FilesystemModuleLoader`) can be extended to:
- Support different file formats
- Add caching
- Support remote modules (with security considerations)

## Security Considerations

### Current Implementation
- No sandboxing for JavaScript execution
- File loading from user-specified paths
- No network access
- No file system writes (except export)

### Recommendations
- Add path validation for file loading
- Consider adding file size limits
- Document security implications
- Consider adding safe mode for untrusted code

## Future Enhancements

### Potential Improvements
1. **Multi-threaded mesh generation:** Generate mesh in background thread
2. **Undo/redo system:** Track scene history
3. **Script caching:** Cache compiled JavaScript for faster reloads
4. **Plugin system:** Allow custom JavaScript modules
5. **Export formats:** Support OBJ, PLY, and other formats
6. **Animation support:** Timeline and keyframe animation
7. **Material system:** Support textures and materials
8. **Scene graph:** Hierarchical scene representation

### Documentation Improvements
1. Interactive API documentation
2. Tutorial examples
3. Video tutorials
4. Example gallery

## Dependencies

### Build-Time
- CMake 3.18+
- C++17 compiler
- C11 compiler (for QuickJS)

### Runtime
- Raylib 4.0+
- TBB (Threading Building Blocks)
- QuickJS (statically linked)
- Manifold (statically linked)

### System
- OpenGL (via Raylib)
- File system access
- Font rendering (optional)

## Testing

### Current State
- No automated tests
- Manual testing via `scene.js` editing
- Visual verification of output

### Recommendations
- Add unit tests for JavaScript bindings
- Add integration tests for geometry operations
- Add visual regression tests
- Add performance benchmarks


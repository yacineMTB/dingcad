# helscoop Architecture-as-Code Development TODO

**Project Goal:** Transform helscoop into a professional architecture-as-code tool
**Strategy:** Inside-out development with automated testing at each step

---

## PHASE 0: Testing Infrastructure (Week 1-2) ✅ COMPLETE

### 0.1 Offscreen Rendering for Automated Tests
**Why:** Need to verify geometry renders correctly without manual inspection
**Goal:** `./helscoop_viewer --render scene.js output.png`

- [x] Research raylib `RenderTexture` API for offscreen rendering
- [x] Add command-line argument parsing to main.cpp
  - [x] Use `argc`/`argv` to detect `--render` flag
  - [x] Parse input scene file path
  - [x] Parse output image file path
- [x] Implement offscreen rendering mode in main.cpp
  - [x] Create `RenderTexture2D` instead of window when in render mode
  - [x] Render all passes (toon, normal/depth, composite) to texture
  - [x] Export texture to PNG using `ExportImage()`
  - [x] Exit after rendering (no interactive loop)
- [x] Test with existing coop.js scene
  - [x] Render from front view: `--render scene.js front.png --view front`
  - [x] Render from top view: `--render scene.js top.png --view top`
  - [x] Verify images are created correctly
- [x] Create test helper script: `./scripts/test-render.sh`
  - [x] Renders a scene from multiple angles
  - [x] Compares output to reference images (if they exist)
  - [x] Reports pass/fail

**Files to create/modify:**
- `viewer/main.cpp`: Add CLI parsing, offscreen mode ✅
- `scripts/test-render.sh`: Test automation script ✅
- `tests/fixtures/`: Reference images for comparison

---

## PHASE 1: Building Primitives (Week 3-8)

### 1.1 Wall Primitive - Basic Implementation ✅ COMPLETE
**Goal:** `Wall({start: [0,0], end: [3000,0], height: 2000})`

#### 1.1.1 Core Wall Function (Week 3) ✅
- [x] Create `viewer/primitives/` directory
- [x] Create `viewer/primitives/wall.h`
  - [x] Define `WallParams` struct with fields:
    - `vec2 start`, `vec2 end` (2D coordinates)
    - `double height`
    - `double thickness` (default 98mm)
    - `double bottomPlateHeight` (default 48mm)
    - `double topPlateHeight` (default 48mm)
  - [x] Declare `Manifold CreateWall(WallParams params)`
- [x] Create `viewer/primitives/wall.cpp`
  - [x] Implement `CreateWall()` function
    - [x] Calculate wall length: `sqrt((end.x-start.x)^2 + (end.y-start.y)^2)`
    - [x] Calculate wall angle: `atan2(end.y-start.y, end.x-start.x)`
    - [x] Create main wall cuboid: `cube({length, thickness, height})`
    - [x] Rotate wall to correct angle around Z axis
    - [x] Translate wall to start position
    - [x] Return manifold
- [x] Update `viewer/CMakeLists.txt`
  - [x] Add `primitives/wall.cpp` to source list
- [x] Compile and fix any errors
  - [x] `cmake --build build`
  - [x] Verify wall.cpp compiles

#### 1.1.2 JavaScript Binding (Week 3) ✅
- [x] Open `viewer/js_bindings.cpp`
- [x] Add `JsWall()` function after other primitives (around line 800)
  - [x] Function signature: `JSValue JsWall(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)`
  - [x] Parameter validation: expect 1 argument (object)
  - [x] Extract parameters from JS object:
    - [x] `start` array: `JS_GetPropertyStr(ctx, argv[0], "start")`
    - [x] `end` array: `JS_GetPropertyStr(ctx, argv[0], "end")`
    - [x] `height`: `JS_GetPropertyStr(ctx, argv[0], "height")`
    - [x] `thickness`: `JS_GetPropertyStr(ctx, argv[0], "thickness")` (optional, default 98)
  - [x] Validate required parameters exist
  - [x] Convert JS arrays to C++ vectors
  - [x] Create `WallParams` struct
  - [x] Call `CreateWall(params)`
  - [x] Wrap result in `JsManifold` and return
- [x] Register function in global context (around line 1345)
  - [x] `JS_SetPropertyStr(ctx, global, "Wall", JS_NewCFunction(ctx, JsWall, "Wall", 1));`
- [x] Compile and test
  - [x] `cmake --build build`
  - [x] Fix any compilation errors

#### 1.1.3 Basic Test Scene (Week 3) ✅
- [x] Create `demo_simple_room.js` (instead of test_wall.js)
  - [x] Import wall: `const w = Wall({start: [0,0], end: [3000,0], height: 2000});`
  - [x] Color it: `const coloredWall = withColor(w, [0.7, 0.6, 0.4]);`
  - [x] Export scene: `export const scene = [coloredWall];`
- [x] Render test scene
  - [x] `./build/viewer/helscoop_viewer --render demo_simple_room.js demo_room.png`
  - [x] Open `demo_room.png` and verify:
    - [x] Wall is visible
    - [x] Wall is 4000mm long
    - [x] Wall is tan/wood colored
    - [x] Wall appears solid (no holes or artifacts)
- [x] Rendering works, saved multiple reference images

#### 1.1.4 Stick-Frame Construction (Week 4) ✅ COMPLETE
**Goal:** `Wall({construction: "stickFrame", studSize: [48,98], studSpacing: 400})`

- [x] Update `WallParams` struct in `wall.h`
  - [x] Add `enum ConstructionType { SOLID, STICK_FRAME }`
  - [x] Add `ConstructionType constructionType` (default SOLID)
  - [x] Add `array<double,2> studSize` (default [48, 98])
  - [x] Add `double studSpacing` (default 400mm)
  - [x] Add `bool includeSheathing` (default false)
  - [x] Add `double sheathingThickness` (default 12mm)
- [x] Implement stick-frame logic in `wall.cpp`
  - [x] Function: `Manifold CreateStickFrameWall(WallParams params)`
  - [x] Create bottom plate with correct depth (studDepth)
  - [x] Create top plate: same, translated to height
  - [x] Calculate number of studs: `num_studs = ceil(length / spacing) + 1`
  - [x] Create studs in loop:
    - [x] Stud geometry: `cube({studWidth, studDepth, studHeight}, false)`
    - [x] Position at intervals: `x = i * spacing`
    - [x] Translate to correct position with center:false semantics
  - [x] Union all components: `union(bottomPlate, topPlate, ...studs)`
  - [x] If `includeSheathing`:
    - [x] Create sheathing panel: `cube({length, sheathingThickness, height}, false)`
    - [x] Position on back side: `translate([0, studDepth, 0])`
    - [x] Union with frame
  - [x] Return manifold
- [x] Update `CreateWall()` to dispatch based on construction type
  - [x] `if (params.constructionType == STICK_FRAME) return CreateStickFrameWall(params);`
  - [x] `else return CreateSolidWall(params);`
- [x] Update JS binding to parse construction parameters
  - [x] Check for `construction` property in JS object
  - [x] Parse string "stickFrame" or "solid"
  - [x] Extract `studSize`, `studSpacing`, `includeSheathing` fields
  - [x] Set in `WallParams`
- [x] Created multiple test scenes:
  - [x] `demo_simple_room.js` - 4m x 3m room with stick-frame walls
  - [x] `coop.js` - All four walls converted to Wall() primitive
- [x] Render and verify:
  - [x] Individual studs visible ✅
  - [x] Spacing appears even ✅
  - [x] Plates at top and bottom ✅
  - [x] Sheathing visible if enabled ✅
  - [x] Fixed hovering geometry bug - studs now sit properly on plates ✅

#### 1.1.5 Wall Relationships & Smart Positioning (Week 5)
**Goal:** Wall knows its start/end, can be queried for attachment points

- [ ] Add metadata system to JS binding
  - [ ] Instead of returning raw manifold, return object:
    ```javascript
    {
      geometry: manifold,
      type: 'wall',
      params: {start, end, height, thickness},
      helpers: {
        center: () => [(start[0]+end[0])/2, (start[1]+end[1])/2],
        at: (distance) => /* point along wall */,
        perpendicular: () => /* perpendicular direction */
      }
    }
    ```
  - [ ] Update `JsWall()` to return this structure
  - [ ] Scene parser must extract `.geometry` when rendering
- [ ] Update scene parser in `main.cpp`
  - [ ] Check if scene element has `geometry` property
  - [ ] If yes, extract geometry manifold
  - [ ] Also extract `type` and store in metadata
- [ ] Test smart positioning
  - [ ] Create `tests/test_wall_positioning.js`
  - [ ] Create two perpendicular walls using `.at()` helper
  - [ ] Render and verify they meet correctly

### 1.2 Floor Primitive (Week 6)
**Goal:** `Floor({size: [3000, 3000], construction: StickFrame()})`

#### 1.2.1 Core Floor Function
- [ ] Create `viewer/primitives/floor.h`
  - [ ] Define `FloorParams` struct:
    - `vec2 size` (length, width)
    - `double elevation` (default 0)
    - `ConstructionType constructionType`
    - `vec2 joistSize` (default [48, 98])
    - `double joistSpacing` (default 400)
    - `double subflooringThickness` (default 18)
  - [ ] Declare `Manifold CreateFloor(FloorParams params)`
- [ ] Create `viewer/primitives/floor.cpp`
  - [ ] Implement `CreateSolidFloor()` - simple slab
  - [ ] Implement `CreateStickFrameFloor()`
    - [ ] Create rim joists (perimeter)
    - [ ] Create interior joists at spacing intervals
    - [ ] Create subflooring panel on top
    - [ ] Union all components
  - [ ] Implement `CreateFloor()` dispatcher
- [ ] Add to CMakeLists.txt
- [ ] Create JS binding `JsFloor()` in js_bindings.cpp
- [ ] Register function globally
- [ ] Test scene: `tests/test_floor.js`
  - [ ] Create floor with stick-frame construction
  - [ ] Render and verify joists are visible

### 1.3 Roof Primitive (Week 7)
**Goal:** `Roof({type: 'gable', pitch: 22.5, walls: [w1, w2, w3, w4]})`

#### 1.3.1 Core Roof Function
- [ ] Create `viewer/primitives/roof.h`
  - [ ] Define `RoofParams` struct:
    - `enum RoofType { FLAT, GABLE, HIP, SHED }`
    - `RoofType type`
    - `double pitch` (degrees)
    - `double overhang` (default 300mm)
    - `double thickness` (default 18mm sheathing)
    - `vec2 bounds` (bounding box from walls)
  - [ ] Declare `Manifold CreateRoof(RoofParams params)`
- [ ] Create `viewer/primitives/roof.cpp`
  - [ ] Implement `CreateGableRoof()`
    - [ ] Calculate ridge height from pitch
    - [ ] Create two rectangular panels
    - [ ] Rotate to pitch angle
    - [ ] Position on ridgeline
    - [ ] Add overhang extensions
  - [ ] Implement `CreateFlatRoof()` - simple slab
  - [ ] Implement `CreateRoof()` dispatcher
- [ ] Add to CMakeLists.txt
- [ ] Create JS binding `JsRoof()`
- [ ] Test scene: `tests/test_roof.js`

### 1.4 Door Primitive (Week 7)
**Goal:** `Door({width: 700, height: 1700, wall: wallObj})`

#### 1.4.1 Core Door Function
- [ ] Create `viewer/primitives/door.h`
  - [ ] Define `DoorParams` struct:
    - `double width`, `height`
    - `enum DoorStyle { SINGLE, DOUBLE, SLIDING }`
    - `double thickness` (default 40mm)
    - `vec3 position` (where to place it)
    - `double rotation` (angle)
  - [ ] Declare `Manifold CreateDoor(DoorParams params)`
- [ ] Create `viewer/primitives/door.cpp`
  - [ ] Implement `CreateSingleDoor()`
    - [ ] Create door panel: `cube({width, thickness, height})`
    - [ ] Optionally add frame around it
    - [ ] Return manifold
- [ ] JS binding with automatic wall cutout
  - [ ] If `wall` parameter provided:
    - [ ] Create door geometry
    - [ ] Create cutout geometry (slightly larger)
    - [ ] Return `{door: doorManifold, cutout: cutoutManifold}`
    - [ ] Scene must difference cutout from wall
- [ ] Test scene: `tests/test_door.js`
  - [ ] Create wall + door with cutout
  - [ ] Render and verify hole appears in wall

### 1.5 Window Primitive (Week 8)
**Goal:** `Window({width: 600, height: 900, sill: 900, wall: wallObj})`

#### 1.5.1 Core Window Function
- [ ] Similar structure to Door
- [ ] Create `viewer/primitives/window.h`
- [ ] Create `viewer/primitives/window.cpp`
- [ ] Implement single-hung, double-hung, casement styles
- [ ] Add glazing (transparent geometry?) - future enhancement
- [ ] JS binding with automatic wall cutout
- [ ] Test scene: `tests/test_window.js`

### 1.6 Stair Primitive (Week 8)
**Goal:** `Stair({rise: 180, run: 280, width: 900, numSteps: 12})`

#### 1.6.1 Core Stair Function
- [ ] Create `viewer/primitives/stair.h`
- [ ] Create `viewer/primitives/stair.cpp`
- [ ] Implement straight-run stair
  - [ ] Each step is a tread (run) + riser (rise)
  - [ ] Stack steps vertically
  - [ ] Add stringers on sides (structural support)
- [ ] JS binding
- [ ] Test scene: `tests/test_stair.js`

---

## PHASE 2: Measurement Tools (Week 9-10)

### 2.1 Expose Manifold Calculations to JavaScript

#### 2.1.1 Area Calculation
- [ ] In `js_bindings.cpp`, add `JsGetArea()` function
  - [ ] Extract manifold from argument
  - [ ] Call `manifold.SurfaceArea()`
  - [ ] Return as JS number
- [ ] Register `getArea` globally
- [ ] Test in scene:
  ```javascript
  const wall = Wall({start: [0,0], end: [3000,0], height: 2000, thickness: 98});
  console.log('Wall area:', getArea(wall), 'mm²');
  ```

#### 2.1.2 Volume Calculation
- [ ] Add `JsGetVolume()` function
  - [ ] Call `manifold.Volume()`
  - [ ] Return as JS number
- [ ] Register `getVolume` globally
- [ ] Test in scene

#### 2.1.3 Bounding Box Query
- [ ] Add `JsGetBoundingBox()` function
  - [ ] Call `manifold.BoundingBox()`
  - [ ] Return JS object: `{min: [x,y,z], max: [x,y,z]}`
- [ ] Register `getBoundingBox` globally
- [ ] Test in scene

### 2.2 Dimension Display (Future Enhancement)
- [ ] Design system for text rendering in 3D space
- [ ] Integrate with Dear ImGui or similar for overlay
- [ ] Draw dimension lines, arrows, text labels
- [ ] This is complex - defer to later phase

---

## PHASE 3: Component Library System (Week 11-13)

### 3.1 Component Definition Format

#### 3.1.1 Create Component Base Class
- [ ] Create `library/core/component.js`
- [ ] Define `defineComponent()` function:
  ```javascript
  export function defineComponent(config) {
    // Validate config has name, parameters, generate function
    // Return component object with metadata
    return {
      name: config.name,
      category: config.category,
      parameters: config.parameters,
      generate: config.generate,
      validate: (params) => { /* check parameter types/ranges */ }
    };
  }
  ```
- [ ] Test by defining a simple component

#### 3.1.2 Parameter Validation System
- [ ] Create parameter type system:
  - `number`: min/max/default
  - `vec2`, `vec3`: array of numbers
  - `boolean`: true/false
  - `enum`: list of valid values
  - `string`: freeform text
- [ ] Implement validation in `defineComponent()`
- [ ] Throw errors for invalid parameters

### 3.2 Example Component Libraries

#### 3.2.1 Wood Framing Library
- [ ] Create `library/wood-framing/`
- [ ] Create `library/wood-framing/stick-frame.js`
  - [ ] `StickFrame` component wrapping existing logic
  - [ ] Parameters: studSize, spacing, sheathing
- [ ] Create `library/wood-framing/truss-roof.js`
  - [ ] `TrussRoof` component
  - [ ] Parameters: span, pitch, spacing
  - [ ] Generate truss geometry (complex!)
- [ ] Create `library/wood-framing/index.js` to export all

#### 3.2.2 Modular Construction Library
- [ ] Create `library/modular/`
- [ ] Create `library/modular/box-module.js`
  - [ ] Complete room module (floor, walls, ceiling)
  - [ ] Parametric: length, width, height
  - [ ] Includes windows, door, wiring channels
- [ ] This could power prefab construction workflows

### 3.3 Component Catalog (CLI Tool)
- [ ] Create `scripts/component-list.js`
  - [ ] Scans `library/` directory
  - [ ] Lists all components with parameters
  - [ ] Shows usage examples
- [ ] Add npm script: `npm run components`
- [ ] Output should be readable reference

---

## PHASE 4: Building Code Validation (Week 14-16)

### 4.1 Stair Code Checks (IBC 1011.5.2)

#### 4.1.1 Create Validation Module
- [ ] Create `library/codes/ibc2024.js`
- [ ] Export object with validation functions:
  ```javascript
  export const IBC2024 = {
    validateStair: (stairParams) => {
      const errors = [];
      if (stairParams.rise > 196) {
        errors.push({
          level: 'error',
          code: '1011.5.2',
          message: 'Maximum riser height is 196mm (7.75")',
          actual: stairParams.rise
        });
      }
      if (stairParams.run < 280) {
        errors.push({
          level: 'error',
          code: '1011.5.2',
          message: 'Minimum tread depth is 280mm (11")',
          actual: stairParams.run
        });
      }
      // More checks...
      return errors;
    }
  };
  ```

#### 4.1.2 Integrate with Stair Primitive
- [ ] Update `JsStair()` binding to call validation
- [ ] If errors, either:
  - [ ] Throw exception (strict mode)
  - [ ] Print warnings to console (permissive mode)
  - [ ] Return errors in metadata
- [ ] Test with invalid stair parameters

### 4.2 Egress Checks (IBC 1010)

#### 4.2.1 Door Width Validation
- [ ] Add `validateEgressDoor()` to IBC2024
  - [ ] Minimum width 810mm (32")
  - [ ] Minimum height 2030mm (80")
- [ ] Integrate with Door primitive

#### 4.2.2 Window Egress Validation
- [ ] Add `validateEgressWindow()` to IBC2024
  - [ ] Minimum opening area 0.52m² (5.7 sq ft)
  - [ ] Minimum width 510mm (20")
  - [ ] Minimum height 610mm (24")
  - [ ] Maximum sill height 1100mm (44") above floor
- [ ] Integrate with Window primitive

### 4.3 Building-Level Validation

#### 4.3.1 Scene Validator
- [ ] Create `validateBuilding()` function
  - [ ] Takes entire scene as input
  - [ ] Checks:
    - [ ] At least one egress door per floor
    - [ ] Bedroom windows meet egress requirements
    - [ ] Stairways meet code
    - [ ] Headroom clearances (2030mm minimum)
  - [ ] Returns report with all violations
- [ ] Test with complete building scene

---

## PHASE 5: Multi-Viewport System (Week 17-20)

### 5.1 Viewport Data Structure

#### 5.1.1 Create Viewport Class
- [ ] Create `viewer/viewport.h`
- [ ] Define `Viewport` class:
  - `Camera3D camera`
  - `ProjectionMode mode` (PERSPECTIVE or ORTHOGRAPHIC)
  - `Rectangle bounds` (screen position/size)
  - `ViewDirection direction` (TOP, FRONT, LEFT, etc.)
- [ ] Create `viewer/viewport.cpp` with implementation

### 5.2 Multi-Viewport Rendering

#### 5.2.1 Update Main Rendering Loop
- [ ] In `main.cpp`, replace single camera with viewport array
- [ ] Define default layout: 2x2 grid
  - Top-left: 3D perspective
  - Top-right: Front elevation (ortho)
  - Bottom-left: Top plan (ortho)
  - Bottom-right: Right elevation (ortho)
- [ ] Render each viewport in sequence:
  ```cpp
  for (auto& viewport : viewports) {
    BeginScissorMode(viewport.bounds.x, viewport.bounds.y,
                     viewport.bounds.width, viewport.bounds.height);
    BeginMode3D(viewport.camera);
    // Draw scene...
    EndMode3D();
    EndScissorMode();
  }
  ```
- [ ] Test with coop scene - should see 4 views

### 5.3 Orthographic Camera Setup

#### 5.3.1 Create Preset Cameras
- [ ] Function `Camera3D CreateTopViewCamera(bounds)`
  - [ ] Position: above building looking down
  - [ ] Up vector: [0, 1, 0] (north is up)
  - [ ] Orthographic projection
- [ ] Function `CreateFrontViewCamera()`
- [ ] Function `CreateLeftViewCamera()`
- [ ] Function `CreateRightViewCamera()`
- [ ] Test each view renders correctly

### 5.4 Section View (Complex)
- [ ] Implement cut plane visualization
  - [ ] Define plane: point + normal
  - [ ] Clip geometry using Manifold boolean operations
  - [ ] Cap cut faces (show interior)
- [ ] This is advanced - defer to later

---

## PHASE 6: BIM Metadata (Week 21-24)

### 6.1 Metadata Schema

#### 6.1.1 Define Standard Schemas
- [ ] Create `library/metadata/schemas.js`
- [ ] Define material schema:
  ```javascript
  export const MaterialSchema = {
    name: String,
    density: Number,  // kg/m³
    thermalResistance: Number,  // R-value
    cost: Number,  // per m³
    embodiedCarbon: Number,  // kg CO2e per m³
    fireRating: String,  // '1-hour', '2-hour', etc.
    supplier: String
  };
  ```
- [ ] Define component installation schema
- [ ] Define structural properties schema

### 6.2 Attach Metadata to Geometry

#### 6.2.1 Extend Scene Data Structure
- [ ] In `main.cpp`, extend `BuildingElement` struct:
  ```cpp
  struct BuildingElement {
    std::shared_ptr<manifold::Manifold> geometry;
    Color color;
    std::string type;
    std::string id;
    std::string layer;
    std::map<std::string, std::string> metadata;  // Already exists
    std::map<std::string, double> numericMetadata;  // Add this
    std::vector<std::string> relationships;
  };
  ```
- [ ] Update scene parser to extract metadata from JS objects

#### 6.2.2 Update Primitives to Include Metadata
- [ ] Update `Wall()` to return metadata:
  ```javascript
  {
    geometry: wallManifold,
    type: 'wall',
    metadata: {
      material: 'SPF Lumber',
      volume: calculatedVolume,
      cost: volume * materialCostPerUnit,
      embodiedCarbon: volume * carbonPerUnit
    }
  }
  ```
- [ ] Update Floor, Roof, etc. similarly

### 6.3 Metadata Analysis Functions

#### 6.3.1 Bill of Materials Generator
- [ ] Create `library/analysis/bom.js`
- [ ] Function `generateBillOfMaterials(scene)`:
  - [ ] Iterate all elements
  - [ ] Group by material
  - [ ] Sum volumes
  - [ ] Calculate quantities (e.g., number of 2x4 studs)
  - [ ] Return structured data
- [ ] Export to JSON, CSV

#### 6.3.2 Cost Estimator
- [ ] Create `library/analysis/cost.js`
- [ ] Function `estimateCost(scene)`:
  - [ ] Sum material costs from metadata
  - [ ] Add labor costs (hours * rate)
  - [ ] Add overhead percentage
  - [ ] Return total with breakdown
- [ ] Test with coop scene

#### 6.3.3 Carbon Calculator
- [ ] Create `library/analysis/carbon.js`
- [ ] Function `calculateEmbodiedCarbon(scene)`:
  - [ ] Sum embodiedCarbon from all elements
  - [ ] Return total kg CO2e
  - [ ] Compare to benchmarks
- [ ] Useful for green building certifications

---

## PHASE 7: IFC Export (Week 25-30)

### 7.1 Research IFC Libraries

#### 7.1.1 Evaluate Options
- [ ] Research IFC++ (C++ library)
- [ ] Research other IFC SDKs
- [ ] Choose one and integrate via CMake

### 7.2 Geometry Export

#### 7.2.1 Convert Manifold to IFC B-Rep
- [ ] Extract vertices and faces from Manifold
- [ ] Convert to IFC's B-Rep representation
- [ ] Handle curved surfaces (approximate with facets)

### 7.3 Relationship Hierarchy

#### 7.3.1 Create IFC Structure
- [ ] Root: `IfcProject`
- [ ] Child: `IfcSite`
- [ ] Child: `IfcBuilding`
- [ ] Child: `IfcBuildingStorey`
- [ ] Children: `IfcWall`, `IfcSlab`, `IfcRoof`, etc.

### 7.4 Property Sets

#### 7.4.1 Export Metadata as IFC Properties
- [ ] Map helscoop metadata to IFC `IfcPropertySet`
- [ ] Common property sets:
  - `Pset_WallCommon`
  - `Pset_SlabCommon`
  - `Pset_DoorCommon`

### 7.5 Testing & Validation

#### 7.5.1 Validate IFC Files
- [ ] Use IFC validation tools (online or CLI)
- [ ] Test import in Revit
- [ ] Test import in ArchiCAD
- [ ] Test import in Navisworks
- [ ] Fix any geometry or metadata issues

---

## TESTING STRATEGY

### Automated Tests at Each Phase

#### Unit Tests (C++)
- [ ] Set up Google Test framework
- [ ] Test each primitive function:
  - [ ] `CreateWall()` returns valid manifold
  - [ ] `CreateFloor()` with different parameters
  - [ ] Wall + Door cutout produces hole
- [ ] Run: `./build/tests/helscoop_tests`

#### Integration Tests (JavaScript + Rendering)
- [ ] For each primitive, create test scene
- [ ] Render to PNG
- [ ] Compare to reference image (pixel difference)
- [ ] Threshold: <5% difference is pass
- [ ] Run: `./scripts/test-all.sh`

#### Validation Tests (Building Codes)
- [ ] Create scenes with intentional code violations
- [ ] Verify validator catches them
- [ ] Example: stair with 200mm rise (too high)
- [ ] Assert error is returned

#### Visual Inspection Tests
- [ ] Complex scenes rendered for manual review
- [ ] Save in `tests/visual/` directory
- [ ] Periodically reviewed by developer

---

## TOOLING & INFRASTRUCTURE

### Development Tools
- [ ] Set up clang-format for C++ code formatting
- [ ] Set up prettier for JavaScript formatting
- [ ] Set up pre-commit hooks for linting
- [ ] Create `Makefile` with common commands:
  - `make build`: Compile project
  - `make test`: Run all tests
  - `make render SCENE=scene.js`: Render a scene
  - `make clean`: Clean build artifacts

### Documentation
- [ ] Set up documentation site (MkDocs or similar)
- [ ] Write API reference for each primitive
- [ ] Write tutorials:
  - [ ] "Your First Wall"
  - [ ] "Building a Tiny House"
  - [ ] "Validating Against Building Codes"
- [ ] Record video tutorials (YouTube)

### CI/CD
- [ ] Set up GitHub Actions workflow:
  - [ ] On push: compile, run tests, report results
  - [ ] On PR: run tests, block merge if failing
  - [ ] On tag: build release binaries
- [ ] Automated test rendering in CI
  - [ ] Upload rendered images as artifacts
  - [ ] Compare to reference images

---

## PRIORITIZATION CHEAT SHEET

**Must Have (MVP):**
1. ✅ Offscreen rendering for tests
2. Wall, Floor, Roof primitives (basic solid versions)
3. Measurement functions (area, volume)
4. Basic test suite

**Should Have (Professional Use):**
4. Stick-frame construction for Wall/Floor
5. Door, Window primitives with cutouts
6. Basic code validation (stair, egress)
7. Multi-viewport system

**Nice to Have (Advanced Features):**
8. Component library system
9. BIM metadata and analysis
10. IFC export

**Future (Cutting Edge):**
11. Performance simulation integration
12. Generative design
13. Collaboration features

---

## GETTING STARTED - NEXT SESSION

**Immediate next steps:**
1. [x] Check background build status
2. [ ] Implement offscreen rendering in main.cpp
3. [ ] Test render-to-file with coop.js scene
4. [ ] Create first Wall() primitive (solid version)
5. [ ] Test Wall() renders correctly

**Command to get started:**
```bash
# Check if build is running
# Implement --render flag
# Test: ./build/viewer/helscoop_viewer --render coop.js output.png
```

Let's build the future of architecture! 🏗️

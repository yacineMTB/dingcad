# Architecture-as-Code: Transforming helscoop into a Professional Architecture Tool

## Executive Summary

This document outlines a comprehensive plan to transform helscoop from a general-purpose CAD tool into a specialized "architecture-as-code" platform. The vision is to bring the benefits of Infrastructure-as-Code (version control, CI/CD, code review, testing) to architectural design while maintaining parametric flexibility and BIM interoperability.

**Target Users:**
- Architects working on parametric/computational design
- Modular construction companies
- Design-build firms seeking code-driven workflows
- Architecture educators teaching computational design
- Engineering teams needing automated code compliance

---

## Part 1: Current State Analysis

### What helscoop Does Well

**1. Robust Geometry Foundation**
- Manifold geometry kernel ensures watertight, valid solids
- CSG operations (union, difference, intersection) are reliable
- No "bad geometry" issues common in other CAD tools

**2. Code-First Workflow**
- JavaScript scripting provides full programmability
- Live reload enables rapid iteration (sub-second feedback)
- Version control friendly (plain text .js files)
- Easy to template and automate

**3. Performance**
- C++ core with raylib rendering is fast
- Handles complex geometry efficiently
- Sub-second reload times even for large models

**4. Extensibility**
- QuickJS integration makes adding new APIs straightforward
- 50+ existing JavaScript functions (primitives, operations, transforms)
- Recent color system addition shows extensibility in action

**5. Visual Quality**
- Multi-pass toon shading with edge detection
- Professional appearance suitable for presentations
- Color support for material differentiation

### Critical Gaps for Architecture Use

**1. Building-Specific Primitives** ⚠️ HIGH PRIORITY
- No `wall()`, `floor()`, `roof()`, `stair()`, `window()`, `door()` functions
- Current workaround: Manual composition from cubes (verbose, error-prone)
- Example: 20+ lines to create a framed wall vs. `wall({length: 3000, height: 2000})`

**2. Parametric Constraints** ⚠️ HIGH PRIORITY
- No automatic relationship management between elements
- Changes require manual updates throughout code
- No "snap to" or alignment helpers
- Missing: "this wall sits on that floor" type relationships

**3. BIM Metadata** ⚠️ MEDIUM PRIORITY
- No material properties (R-value, cost, weight, fire rating)
- No component metadata (manufacturer, model number, warranty)
- No scheduling data (lead times, installation sequence)
- Can't generate bills of materials or cost estimates

**4. Measurement & Dimensioning** ⚠️ HIGH PRIORITY
- No dimension display in viewport
- No area/volume calculations exposed to user
- No measurement tools for verification
- Hard to verify designs meet dimensional requirements

**5. Multiple Viewports** ⚠️ MEDIUM PRIORITY
- Single 3D view only
- Missing: Plan, North/South/East/West elevations, sections
- Architects need orthographic 2D views for documentation
- No "cut plane" visualization

**6. Building Code Compliance** ⚠️ MEDIUM PRIORITY
- No automated checking (egress width, stair rise/run, fire separation)
- No integration with code databases (IBC, IRC, local amendments)
- Manual verification required (error-prone, time-consuming)

**7. IFC/BIM Interoperability** ⚠️ LOW PRIORITY (Phase 2)
- No IFC import/export (industry standard BIM format)
- Can't integrate with Revit/ArchiCAD workflows
- GLTF export exists but no material properties

**8. Component Library System** ⚠️ HIGH PRIORITY
- No standardized way to package reusable components
- No parameter validation or documentation system
- No component catalog/browser
- Each project re-implements common elements

**9. Annotation System** ⚠️ LOW PRIORITY (Phase 3)
- No text labels, dimension lines, or symbols in 3D space
- No 2D drawing overlay system
- Can't produce construction documents from 3D model

**10. Layer/System Organization** ⚠️ LOW PRIORITY (Phase 2)
- No concept of building systems (structural, mechanical, electrical)
- Can't selectively show/hide elements
- No visual hierarchy management

---

## Part 2: Architecture-as-Code Vision

### Core Philosophy

**"Buildings are complex systems best described by code, not mouse clicks"**

1. **Parametric by Default**: Every dimension is a variable that can be changed
2. **Composable**: Buildings assembled from reusable components
3. **Validated**: Automated checking catches errors before construction
4. **Versionable**: Git tracks every design decision with full history
5. **Testable**: Unit tests verify constraints and relationships
6. **Reviewable**: Code review improves design quality (like software)
7. **Modular**: Component libraries enable rapid assembly
8. **Interoperable**: Exports to standard formats (IFC, GLTF, DXF)

### Target Workflow Example

```javascript
import { Wall, Floor, Roof, Door, Window } from '@helscoop/architecture';
import { StickFrame, Joist } from '@helscoop/wood-framing';
import { IBC2024 } from '@helscoop/codes';

// Define building parameters
const params = {
  length: 3000,
  width: 3000,
  wallHeight: 2000,
  roofPitch: 22.5,
  stickFraming: true
};

// Create foundation
const foundation = Floor({
  size: [params.length, params.width],
  construction: StickFrame({
    joistSize: [48, 98],
    joistSpacing: 400,
    subflooring: { thickness: 18, material: 'Plywood' }
  }),
  elevation: 0
});

// Create walls (automatically sits on foundation)
const frontWall = Wall({
  start: [0, 0],
  end: [params.length, 0],
  height: params.wallHeight,
  construction: StickFrame({ studSize: [48, 98] }),
  basePlate: foundation
});

// Add door (automatically creates cutout)
const door = Door({
  width: 700,
  height: 1700,
  style: 'single',
  location: frontWall.center()  // Smart positioning
});

// Add windows with code compliance
const window = Window({
  width: 600,
  height: 900,
  location: frontWall.at([1000, 900]),
  egressRequired: true  // Validates against IBC egress requirements
});

// Create roof (automatically calculates ridgeline and sits on walls)
const roof = Roof({
  type: 'gable',
  pitch: params.roofPitch,
  overhang: 300,
  walls: [frontWall, backWall, leftWall, rightWall]
});

// Validate against building codes
const validation = IBC2024.validate({
  building: [foundation, frontWall, backWall, leftWall, rightWall, roof],
  occupancy: 'R-3',  // Residential
  context: { jurisdiction: 'California' }
});

if (!validation.passes) {
  console.error('Code violations:', validation.errors);
}

// Export for BIM integration
export const scene = {
  geometry: [foundation, frontWall, backWall, leftWall, rightWall, roof, door, window],
  metadata: {
    project: 'Chicken Coop',
    designed: new Date(),
    parameters: params
  },
  exportFormats: ['ifc', 'gltf', 'dxf']
};
```

### Key Improvements Over Current Workflow

1. **Readability**: `Wall()` vs. 100 lines of cubes and unions
2. **Relationships**: Door automatically cuts wall, roof sits on walls
3. **Validation**: Code compliance checked automatically
4. **Reusability**: `StickFrame()` used for both floor and walls
5. **Discoverability**: Autocomplete shows available options
6. **Safety**: Type checking prevents invalid parameters

---

## Part 3: Implementation Roadmap

### Phase 1: Foundation (3-4 months)
**Goal:** Make helscoop usable for basic architectural modeling

#### 1.1 Building Primitives Library
**Effort:** 6 weeks

Implement core architectural elements:

```cpp
// In js_bindings.cpp, add:
- Wall(start, end, height, thickness, construction)
- Floor(size, elevation, construction)
- Roof(type, pitch, walls, overhang)
- Door(width, height, style, swing)
- Window(width, height, style, sill)
- Stair(rise, run, width, numSteps)
```

Each primitive:
- Returns a Manifold with correct geometry
- Has smart defaults (e.g., wall thickness = 98mm for 2x4 framing)
- Supports construction details (framing, finishes)
- Includes parameter validation

**Files to modify:**
- `viewer/js_bindings.cpp`: Add new JSValue functions
- `viewer/primitives/`: New directory for building elements
- `viewer/primitives/wall.cpp`, `floor.cpp`, `roof.cpp`, etc.

#### 1.2 Measurement Tools
**Effort:** 3 weeks

Add measurement and verification:

```javascript
// New JavaScript API functions
const area = getArea(manifold);  // Returns surface area
const volume = getVolume(manifold);  // Returns volume
const bounds = getBoundingBox(manifold);  // Returns {min, max}
const distance = measureDistance(point1, point2);
```

Implement:
- Area/volume calculation (manifold already has this, expose to JS)
- Bounding box queries
- Distance measurement between points
- Dimension display overlay (text in 3D space)

**Files to modify:**
- `viewer/js_bindings.cpp`: Expose measurement functions
- `viewer/main.cpp`: Add dimension rendering pass

#### 1.3 Component Library System
**Effort:** 4 weeks

Create standardized component packaging:

```javascript
// Component definition format
export const StickFrame = defineComponent({
  name: 'Stick Frame Wall',
  category: 'Structure/Wood',
  parameters: {
    studSize: { type: 'vec2', default: [48, 98], label: 'Stud Size (mm)' },
    studSpacing: { type: 'number', default: 400, min: 300, max: 600, label: 'Spacing (mm)' },
    sheathing: { type: 'boolean', default: true, label: 'Include Sheathing' }
  },
  generate: (params) => {
    // Return manifold geometry + metadata
    return {
      geometry: ...,
      materials: [{ name: 'SPF Lumber', volume: ... }],
      cost: calculateCost(params)
    };
  }
});
```

Features:
- Parameter validation with types and ranges
- Automatic documentation generation
- Component catalog browser (CLI or web UI)
- Package manager integration (npm for architecture components)

**Implementation:**
- `library/core/component.js`: Component definition system
- `library/wood-framing/`: Example component library
- `library/modular/`: Modular construction components
- CLI command: `helscoop components list`

#### 1.4 Basic Building Code Validation
**Effort:** 3 weeks

Start with most common checks:

```javascript
// In library/codes/ibc2024.js
export const IBC2024 = {
  validateStair: (stair) => {
    const checks = [];
    if (stair.rise > 196) {
      checks.push({ level: 'error', code: '1011.5.2', message: 'Max rise 196mm' });
    }
    if (stair.run < 280) {
      checks.push({ level: 'error', code: '1011.5.2', message: 'Min run 280mm' });
    }
    return checks;
  },

  validateEgress: (door) => {
    if (door.width < 810) {
      return [{ level: 'error', code: '1010.1.1', message: 'Egress door min 810mm' }];
    }
    return [];
  }
};
```

Implement checks for:
- Stair rise/run (IBC 1011.5.2)
- Egress door width (IBC 1010.1.1)
- Egress window size (IBC 1030.2)
- Headroom clearances
- Guard/handrail requirements

**Files:**
- `library/codes/ibc2024.js`: International Building Code checks
- `library/codes/irc2024.js`: International Residential Code checks
- Integration with component validation system

### Phase 2: Professional Features (4-5 months)
**Goal:** Make helscoop production-ready for professional use

#### 2.1 Multi-Viewport System
**Effort:** 6 weeks

Implement standard architectural views:

- Plan view (top-down, orthographic)
- North/South/East/West elevations (orthographic)
- Section views (cut plane visualization)
- 3D perspective view (existing)
- Synchronized camera controls (zoom in one view, others follow)

**Technical approach:**
- Add viewport grid system to main.cpp
- Each viewport: separate camera + projection matrix
- Section views: use cut plane + cap faces
- Add UI for view selection and arrangement

**Files to modify:**
- `viewer/main.cpp`: Multi-viewport rendering
- `viewer/viewport.cpp`: New file for viewport management
- `viewer/camera.cpp`: Separate orthographic camera class

#### 2.2 BIM Metadata System
**Effort:** 5 weeks

Associate rich data with geometry:

```javascript
const wall = Wall({
  /* geometry params */
  metadata: {
    material: {
      name: 'SPF Lumber',
      thermalResistance: 2.1,  // R-value
      cost: 850,  // per m³
      embodiedCarbon: 45,  // kg CO2e per m³
      fireRating: '1-hour'
    },
    manufacturer: 'Local Supplier',
    leadTime: 14,  // days
    installation: {
      crew: 2,
      hours: 4,
      sequence: 10
    }
  }
});

// Query metadata
const bom = generateBillOfMaterials(scene);
const cost = estimateCost(scene);
const schedule = generateSchedule(scene);
const carbon = calculateEmbodiedCarbon(scene);
```

**Implementation:**
- Extend ColoredObject to include metadata dict
- Create metadata schema for common building elements
- Implement aggregation functions (BOM, cost estimation)
- Add metadata export (JSON, CSV)

**Files to modify:**
- `viewer/main.cpp`: Extend SceneData structure
- `library/metadata/schemas.js`: Standard metadata schemas
- `library/analysis/`: BOM, cost, carbon calculation

#### 2.3 Layer & System Organization
**Effort:** 3 weeks

Group elements by building system:

```javascript
const scene = {
  layers: {
    foundation: { visible: true, color: [0.5, 0.5, 0.5] },
    structure: { visible: true, color: [0.7, 0.6, 0.4] },
    envelope: { visible: true, color: [0.9, 0.9, 0.9] },
    mechanical: { visible: false, color: [0.2, 0.6, 0.8] },
    electrical: { visible: false, color: [0.9, 0.7, 0.2] }
  },
  elements: [
    { geometry: foundation, layer: 'foundation' },
    { geometry: wall, layer: 'structure' },
    { geometry: window, layer: 'envelope' }
  ]
};
```

**Features:**
- Layer visibility toggle
- Layer color override
- System-based filtering
- Export individual layers

#### 2.4 Advanced Code Compliance
**Effort:** 4 weeks

Expand validation coverage:

- Fire separation requirements
- Structural loading (basic checks)
- Energy code compliance (prescriptive path)
- Accessibility (ADA/barrier-free)
- Plumbing fixture counts
- Natural ventilation requirements

Integrate with code databases:
- UpCodes API integration (if available)
- Local jurisdiction amendments
- Custom code profiles

### Phase 3: BIM Integration (3-4 months)
**Goal:** Interoperability with industry-standard BIM tools

#### 3.1 IFC Export
**Effort:** 8 weeks

Implement IFC4 file format export:

- Geometry export (B-Rep representation)
- Relationship hierarchy (building → storey → space → element)
- Material properties
- Type definitions
- Quantity takeoffs

**Technical approach:**
- Use IFC++ library (open source C++)
- Map helscoop components to IFC entities
- Preserve metadata in IFC property sets

**Validation:**
- Test with Revit, ArchiCAD, Navisworks
- Verify geometry accuracy
- Confirm metadata preservation

#### 3.2 Advanced Annotation
**Effort:** 5 weeks

Construction documentation system:

- Text labels in 3D/2D space
- Dimension lines (linear, radial, angular)
- Section cut markers
- Detail callouts
- Symbols library (door/window tags, etc.)

Export to DXF/DWG for contractor use.

#### 3.3 Parametric Constraints Engine
**Effort:** 6 weeks

Automatic relationship management:

```javascript
const floor = Floor({ size: [3000, 3000] });
const wall = Wall({ start: [0, 0], end: [3000, 0] });

// Constraint: wall sits on floor
wall.sitsOn(floor);

// Constraint: roof follows wall top
roof.alignsTo(wall, 'top');

// Now if floor elevation changes, wall and roof update automatically
floor.elevation = 200;  // Wall bottom and roof automatically adjust
```

Solver-based system with constraint propagation.

### Phase 4: Advanced Features (Ongoing)
**Goal:** Cutting-edge computational design capabilities

#### 4.1 Performance Simulation Integration
- Energy modeling (EnergyPlus integration)
- Daylighting analysis (Radiance integration)
- Structural pre-analysis (basic FEA)
- Airflow simulation (CFD integration)

#### 4.2 Generative Design
- Multi-objective optimization
- Genetic algorithms for design exploration
- AI-assisted code generation (LLM integration)

#### 4.3 Real-time Collaboration
- Multi-user editing with conflict resolution
- Cloud storage integration
- Change tracking and comments

#### 4.4 Mobile/AR Visualization
- Tablet app for site review
- AR visualization on-site
- QR codes linking to component data

---

## Part 4: Technical Decisions

### Data Structures

**Current:**
```cpp
struct ColoredObject {
  std::shared_ptr<manifold::Manifold> geometry;
  Color color;
};
```

**Proposed:**
```cpp
struct BuildingElement {
  std::shared_ptr<manifold::Manifold> geometry;
  Color color;
  std::string type;  // "wall", "floor", "roof", etc.
  std::string id;  // Unique identifier
  std::string layer;  // "structure", "envelope", etc.
  std::map<std::string, std::string> metadata;
  std::vector<std::string> relationships;  // IDs of related elements
};

struct Building {
  std::vector<BuildingElement> elements;
  std::map<std::string, LayerStyle> layers;
  std::map<std::string, std::string> projectInfo;
  std::vector<Constraint> constraints;
};
```

### File Format Evolution

**Current:** `scene.js` exports geometry
**Proposed:** `project.helscoop/` directory structure:

```
project.helscoop/
├── project.json           # Project metadata
├── main.js               # Main scene code
├── components/           # Custom components
│   ├── custom-truss.js
│   └── special-window.js
├── parameters.json       # Editable parameters (non-coders)
├── metadata/            # BIM data
│   ├── materials.json
│   ├── costs.json
│   └── schedule.json
├── cache/              # Computed geometry cache
│   └── manifest.json
└── exports/            # Generated files
    ├── model.ifc
    ├── model.gltf
    └── drawings.dxf
```

### Component Registry

Components distributed via npm:

```bash
npm install @helscoop/wood-framing
npm install @helscoop/modular-housing
npm install @helscoop/codes-ibc2024
```

Used in code:
```javascript
import { StickFrame, TrusRoof } from '@helscoop/wood-framing';
import { IBC2024 } from '@helscoop/codes-ibc2024';
```

Enables community contribution and standardization.

### API Stability

**Versioning:**
- Major version: Breaking changes to core API
- Minor version: New features, backward compatible
- Patch version: Bug fixes

**Deprecation policy:**
- Features deprecated with 6-month warning
- Migration guides provided
- Automated migration tools where possible

---

## Part 5: Success Metrics

### Technical Metrics
- **Performance**: Load 100+ building elements in <2 seconds
- **Accuracy**: IFC export roundtrip preserves 99%+ geometry
- **Coverage**: 50+ building code checks implemented
- **Library**: 100+ reusable components available
- **Compatibility**: IFC files open correctly in Revit/ArchiCAD

### User Metrics
- **Time to first design**: New user creates simple building in <1 hour
- **Iteration speed**: Change propagates through design in <1 second
- **Error reduction**: 80% fewer dimensional errors vs. manual
- **Adoption**: 100+ active users within 12 months
- **Contributions**: 10+ community-contributed components

### Business Metrics
- **Cost savings**: 30% faster design iteration vs. traditional BIM
- **Code compliance**: 90% issues caught before submission
- **Modularity**: 50% code reuse across projects
- **Collaboration**: 5x faster design review via code review process

---

## Part 6: Risk Analysis

### Technical Risks

**Risk 1: Performance with Complex Buildings**
- Large buildings (1000+ elements) may slow down
- Mitigation: LOD system, spatial indexing, GPU acceleration

**Risk 2: IFC Compatibility**
- IFC is complex, full compliance is difficult
- Mitigation: Focus on subset (structural, architectural), test early

**Risk 3: Code Database Maintenance**
- Building codes updated every 3 years, local amendments
- Mitigation: Community-driven code database, versioned APIs

### Adoption Risks

**Risk 1: Learning Curve**
- Architects may not be comfortable with code
- Mitigation: Visual component browser, templates, extensive docs

**Risk 2: Industry Resistance**
- "Not invented here" syndrome in architecture
- Mitigation: Focus on early adopters (parametric firms, modular builders)

**Risk 3: Integration with Existing Workflows**
- Firms already invested in Revit/ArchiCAD
- Mitigation: Position as upstream parametric tool, not replacement

### Market Risks

**Risk 1: Competition from Established Players**
- Grasshopper/Dynamo already dominant in parametric
- Mitigation: Focus on architecture-as-code differentiation (Git, CI/CD, testing)

**Risk 2: Open Source Sustainability**
- Who pays for ongoing development?
- Mitigation: Dual license (open core + commercial features), consulting services

---

## Part 7: Go-to-Market Strategy

### Target Market Segments

**Primary (Year 1):**
1. **Computational Design Firms**: Already comfortable with Grasshopper, seeking better version control
2. **Modular Construction**: Need parametric component libraries for mass customization
3. **Architecture Schools**: Teaching next-gen computational design

**Secondary (Year 2-3):**
4. **Design-Build Firms**: Value tight integration of design and fabrication data
5. **Residential Developers**: Need templated, code-compliant designs at scale
6. **Engineering Firms**: Structural/MEP engineers seeking parametric coordination

### Positioning

**Tagline:** "Architecture-as-Code: Design buildings like software"

**Key Messages:**
- "Version control for architecture" (Git integration)
- "Test-driven design" (Automated code compliance)
- "Parametric without the spaghetti" (Clean code vs. visual programming)
- "From design to BIM in one workflow" (IFC export)

### Pricing Strategy (if commercial)

**Open Source Core:**
- Geometry engine (Manifold)
- Basic primitives
- Visualization
- Free forever

**Commercial Add-ons:**
- Advanced components libraries (modular, MEP, etc.)
- Code compliance databases (updated quarterly)
- IFC import (not just export)
- Cloud collaboration
- Priority support

**Pricing Tiers:**
- Free: Open source core
- Pro: $50/month (single user, all add-ons)
- Team: $40/month per user (5+ users, collaboration)
- Enterprise: Custom (on-premise, priority support)

### Community Building

**Tactics:**
1. **Open Source First**: Build community via GitHub contributions
2. **Component Marketplace**: Let users share/sell components
3. **Education Program**: Free licenses for students/teachers
4. **Documentation**: Extensive tutorials, video courses, examples
5. **Events**: Sponsor architecture hackathons, conference talks

---

## Part 8: Next Steps

### Immediate (Next 2 Weeks)

1. **Validate with Target Users**
   - Interview 5-10 architects using Grasshopper/Dynamo
   - Get feedback on proposed API design
   - Understand pain points with current tools

2. **Prototype Wall Primitive**
   - Implement basic `Wall()` function in js_bindings.cpp
   - Demonstrate stick-frame construction details
   - Measure performance with 100+ walls

3. **Set Up Infrastructure**
   - GitHub repo for component libraries
   - Documentation site (docs.helscoop.dev)
   - CI/CD for automated testing

### Short Term (Month 1-3)

4. **Phase 1 Kickoff**
   - Implement remaining building primitives
   - Build first component library (wood framing)
   - Create 3-5 example projects (chicken coop, tiny house, shed)

5. **Alpha Testing**
   - Recruit 10 alpha testers
   - Weekly feedback sessions
   - Iterate on API design

6. **Documentation Sprint**
   - API reference
   - Getting started guide
   - Video tutorials (YouTube)

### Medium Term (Month 4-9)

7. **Phase 2 Development**
   - Multi-viewport system
   - BIM metadata
   - Advanced code compliance

8. **Beta Release**
   - Public beta announcement
   - Community component contributions
   - First production projects

9. **Conference Talks**
   - Submit to AIA, ACADIA, SimAUD conferences
   - Publish academic paper on architecture-as-code

### Long Term (Year 1+)

10. **Phase 3: BIM Integration**
    - IFC export
    - Industry certification (buildingSMART)
    - Partnerships with BIM tool vendors

11. **Scale Community**
    - 1000+ active users
    - Component marketplace launch
    - Enterprise pilots

---

## Conclusion

helscoop has a **strong foundation** for becoming a world-class architecture-as-code tool:

✅ Robust geometry engine (Manifold)
✅ Fast, code-first workflow
✅ Modern C++ architecture
✅ Extensible JavaScript API
✅ Live reload for rapid iteration

The **path forward is clear**:

1. **Phase 1** (3-4 months): Add building primitives, measurements, components, basic code checks
2. **Phase 2** (4-5 months): Multi-viewport, BIM metadata, layers, advanced compliance
3. **Phase 3** (3-4 months): IFC export, annotations, constraint solver
4. **Phase 4** (Ongoing): Performance simulation, generative design, collaboration

**This plan is ambitious but achievable.** Each phase delivers value incrementally, allowing validation with real users before committing to the next phase.

The **opportunity is significant**: No existing tool combines parametric flexibility, code-first workflow, and BIM interoperability in the way helscoop can. By focusing on architecture-as-code differentiation (Git, testing, CI/CD), helscoop can carve out a unique position in the market.

**Recommended immediate action:** Start with Phase 1, Task 1.1 (Building Primitives Library). Implement `Wall()`, `Floor()`, and `Roof()` functions as a proof-of-concept, then validate with target users before committing to the full roadmap.

The future of architecture is code. helscoop is positioned to lead that transformation.

---

**Document Version:** 1.0
**Date:** 2025-11-06
**Author:** Architecture-as-Code Research Team
**Next Review:** After Phase 1 completion

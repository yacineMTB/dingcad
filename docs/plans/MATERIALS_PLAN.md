# Helscoop Materials System Plan

## Current State

**What we have:**
- Basic `MaterialItem` struct for BOM/pricing (name, category, link, unitPrice, quantity)
- Per-object `color` support (RGB array, unused in coop.js)
- Toon/cel shading with screen-space edge detection
- Materials data is inline in scene files, no central database

**What's missing:**
- No visual material representation (textures, PBR properties)
- No central material library/database
- No link between geometry materials and visual appearance
- No texture support in renderer

---

## Research Summary: How Others Do It

### Industry Standards

| Software | Approach |
|----------|----------|
| **SketchUp 2025** | Photorealistic materials with albedo/roughness/metalness/normal maps. AI-assisted texture generation. Material library browser. |
| **Revit 2019+** | PBR-ready materials via Appearance Library. Supports diffuse, roughness, bump directly. Integrates with Substance textures. |
| **Blender** | Node-based materials with full PBR (Principled BSDF). Extensive texture map support. Material library add-ons. |
| **glTF 2.0** | Industry-standard JSON schema for PBR materials (metallic-roughness workflow). |
| **Enscape** | Pre-made PBR material library with editor. Real-time preview. |

### PBR Texture Maps (Metallic-Roughness Workflow)

| Map | Purpose | Values |
|-----|---------|--------|
| **Albedo/Base Color** | Surface color without lighting | RGB (sRGB) |
| **Metallic** | Metal vs dielectric | 0.0 (non-metal) to 1.0 (metal) |
| **Roughness** | Surface micro-roughness | 0.0 (smooth/glossy) to 1.0 (rough/matte) |
| **Normal** | Surface detail without geometry | Tangent-space XYZ |
| **Occlusion** | Ambient shadows in crevices | Grayscale |
| **Emission** | Self-illumination | RGB |

### Resources
- [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [rPBR for raylib](https://github.com/victorfisac/rPBR)
- [Physically Based Database](https://physicallybased.info/)
- [Free PBR Textures](https://freepbr.com/)
- [Poliigon](https://www.poliigon.com/)

---

## Proposed Architecture

### 1. Material Database Schema

Store in `materials/materials.json`:

```json
{
  "version": 1,
  "materials": {
    "pine_c24": {
      "name": "Pine C24 Lumber",
      "category": "wood",
      "tags": ["lumber", "structural", "softwood"],

      "visual": {
        "albedo": "textures/wood/pine_albedo.png",
        "normal": "textures/wood/pine_normal.png",
        "roughness": 0.7,
        "metallic": 0.0,
        "scale": [0.001, 0.001]
      },

      "pricing": {
        "unit": "jm",
        "unitPrice": 2.60,
        "supplier": "sarokas",
        "link": "https://www.sarokas.fi/mitallistettu-48x98-c24"
      },

      "physical": {
        "density": 500,
        "thermalConductivity": 0.12
      }
    },

    "galvanized_steel": {
      "name": "Galvanized Steel Sheet",
      "category": "metal",
      "tags": ["roofing", "cladding"],

      "visual": {
        "albedo": [0.7, 0.7, 0.72],
        "roughness": 0.3,
        "metallic": 1.0
      },

      "pricing": {
        "unit": "sqm",
        "unitPrice": 15.00,
        "supplier": "k-rauta"
      }
    }
  },

  "suppliers": {
    "sarokas": {
      "name": "Sarokas",
      "url": "https://www.sarokas.fi",
      "currency": "EUR"
    }
  }
}
```

### 2. Directory Structure

```
materials/
├── materials.json          # Central material database
├── textures/
│   ├── wood/
│   │   ├── pine_albedo.png
│   │   ├── pine_normal.png
│   │   └── pine_roughness.png
│   ├── metal/
│   │   └── galvanized_albedo.png
│   └── concrete/
│       └── ...
└── presets/
    ├── construction.json   # Finnish construction materials
    └── interior.json       # Interior finishes
```

### 3. JS API for Scene Files

```javascript
import { Mat, loadMaterials } from './lib/materials.js';

// Load material database
const mats = loadMaterials('./materials/materials.json');

// Use in geometry
const stud = Cube([48, 98, 2400])
  .material('pine_c24')              // Reference by ID
  .quantity(24);                      // For BOM calculation

// Or inline material definition
const customPanel = Cube([100, 100, 18])
  .material({
    albedo: [0.9, 0.85, 0.7],
    roughness: 0.6,
    name: "Birch Plywood",
    unitPrice: 45.00,
    unit: "sheet"
  });

// Export includes material references
export const scene = [
  { geometry: stud, material: 'pine_c24' },
  { geometry: customPanel, material: 'custom_1' }
];

// Auto-generated BOM from materials
export const materials = generateBOM(scene, mats);
```

### 4. C++ Material System

```cpp
// types.h additions
struct PBRMaterial {
  std::string id;
  std::string name;
  std::string category;

  // Visual properties
  std::optional<Texture2D> albedoMap;
  std::optional<Texture2D> normalMap;
  std::optional<Texture2D> roughnessMap;
  std::optional<Texture2D> metallicMap;

  Color albedoColor = WHITE;      // Fallback if no texture
  float roughness = 0.5f;
  float metallic = 0.0f;
  Vector2 textureScale = {1.0f, 1.0f};

  // Pricing (from current MaterialItem)
  std::string unit;
  float unitPrice = 0.0f;
  std::string supplier;
  std::string link;
};

struct MaterialLibrary {
  std::unordered_map<std::string, PBRMaterial> materials;
  std::filesystem::path basePath;

  bool Load(const std::filesystem::path& jsonPath);
  const PBRMaterial* Get(const std::string& id) const;
};

// Updated ColoredObject
struct SceneObject {
  std::shared_ptr<manifold::Manifold> geometry;
  std::string materialId;           // Reference to library
  std::optional<PBRMaterial> inlineMaterial;  // Or inline
  int quantity = 1;
};
```

### 5. Rendering Pipeline Options

**Option A: Enhanced Toon Shading (Recommended for MVP)**
- Keep current toon aesthetic
- Add texture sampling for albedo variation
- Add normal map support for surface detail
- Add roughness influence on specular highlight size

```glsl
// Enhanced toon fragment shader
uniform sampler2D albedoMap;
uniform sampler2D normalMap;
uniform bool hasAlbedoMap;
uniform float roughness;

void main() {
    vec3 baseColor = hasAlbedoMap
        ? texture(albedoMap, uv).rgb
        : baseColorUniform.rgb;

    vec3 n = hasNormalMap
        ? perturbNormal(normalMap, uv, vNvs, vTangent)
        : normalize(vNvs);

    // Adjust specular based on roughness
    float specPower = mix(128.0, 4.0, roughness);
    // ... rest of toon shading
}
```

**Option B: Full PBR (Future)**
- Integrate rPBR or write custom PBR shaders
- HDR environment maps for reflections
- Image-based lighting (IBL)
- Higher visual fidelity, more complex setup

### 6. Implementation Phases

**Phase 1: Material Database (No Visual Changes)**
- Create `materials/materials.json` schema
- Add JS `loadMaterials()` function
- Parse material references in scene_loader.cpp
- Update BOM panel to use material database
- Link materials to supplier URLs (clickable)

**Phase 2: Basic Textures**
- Add albedo texture support to renderer
- Load textures from material database
- UV coordinate generation for primitives
- Texture scaling/tiling controls

**Phase 3: Normal Maps + Roughness**
- Add normal map support to toon shader
- Generate tangent space data for meshes
- Roughness-based specular variation
- Material preview panel in UI

**Phase 4: Material Library UI**
- Material browser panel
- Thumbnail previews
- Drag-and-drop assignment
- Material editor (roughness/metallic sliders)

**Phase 5: Full PBR (Optional)**
- Replace toon shading with PBR option
- HDR environment loading
- IBL probe baking
- Toggle between toon/PBR modes

---

## Quick Wins (Can Implement Now)

1. **Central Material Database**: JSON file with all material data
2. **Material References**: `{ geometry, material: 'pine_c24' }` format
3. **Auto BOM Generation**: Calculate quantities from geometry volume
4. **Supplier Links**: Make material panel links clickable

## Recommended Next Steps

1. Create `materials/materials.json` with Finnish lumber materials
2. Add `materials.js` library for JS scene files
3. Update `scene_loader.cpp` to parse material references
4. Update `ui_panels.cpp` to show material thumbnails/links

---

## Example: Finnish Construction Materials

```json
{
  "pine_48x98_c24": {
    "name": "48x98 Runkopuu C24",
    "visual": { "albedo": [0.85, 0.75, 0.55], "roughness": 0.7 },
    "pricing": { "unit": "jm", "unitPrice": 2.60 }
  },
  "pine_48x148_c24": {
    "name": "48x148 Lattiavasat C24",
    "visual": { "albedo": [0.85, 0.75, 0.55], "roughness": 0.7 },
    "pricing": { "unit": "jm", "unitPrice": 3.70 }
  },
  "pressure_treated_48x148": {
    "name": "Kestopuu 48x148",
    "visual": { "albedo": [0.45, 0.55, 0.40], "roughness": 0.6 },
    "pricing": { "unit": "jm", "unitPrice": 3.80 }
  },
  "galvanized_roofing": {
    "name": "Peltikatto",
    "visual": { "albedo": [0.7, 0.7, 0.72], "roughness": 0.25, "metallic": 1.0 },
    "pricing": { "unit": "sqm", "unitPrice": 8.50 }
  },
  "osb_9mm": {
    "name": "OSB 9mm",
    "visual": { "albedo": [0.75, 0.65, 0.45], "roughness": 0.8 },
    "pricing": { "unit": "sheet", "unitPrice": 12.50 }
  }
}
```

This approach lets you:
- Gradually add textures as you source them
- Keep toon aesthetic while adding visual depth
- Maintain accurate pricing/BOM functionality
- Eventually upgrade to full PBR if desired

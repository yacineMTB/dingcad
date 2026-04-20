# Thermal Simulation Plan for Helscoop

## Goal
Implement a thermal insulation visualization system that shows heat flow through the building envelope. Users can set outside temperature (e.g., -25°C) and inside temperature (e.g., +20°C) to see:
- Which surfaces lose the most heat (red/blue color gradient)
- Heat flow direction (arrows pointing from hot to cold)
- Total heat loss calculation (W)
- Impact of design features like external nesting box openings

---

## Thermal Physics Model

### Steady-State Heat Transfer
Use simplified 1D heat transfer through building envelope surfaces:

```
Q = U × A × ΔT

Where:
  Q = Heat flow rate (W)
  U = Thermal transmittance (W/m²·K) = 1/R
  R = Thermal resistance (m²·K/W)
  A = Surface area (m²)
  ΔT = Temperature difference (K or °C)
```

### Material Thermal Properties

| Material | Thermal Conductivity λ (W/m·K) | Typical Thickness | R-value (m²·K/W) |
|----------|-------------------------------|-------------------|------------------|
| Pine lumber | 0.12 | 98mm | 0.82 |
| OSB 9mm | 0.13 | 9mm | 0.07 |
| OSB 18mm | 0.13 | 18mm | 0.14 |
| Mineral wool 100mm | 0.035 | 100mm | 2.86 |
| Plywood 9mm | 0.13 | 9mm | 0.07 |
| Steel sheet | 50.0 | 0.5mm | ~0 |
| Air gap | 0.025 (still air) | variable | depends on gap |

R-value calculation: `R = thickness / λ`

### Wall Assembly R-values
For composite walls, sum the R-values of each layer:
```
R_total = R_surface_inside + R_layer1 + R_layer2 + ... + R_surface_outside

Typical surface resistances:
  R_surface_inside = 0.13 m²·K/W (still air)
  R_surface_outside = 0.04 m²·K/W (wind exposure)
```

---

## Implementation Plan

### Phase 1: Add Thermal Properties to Materials (types.h + materials.json)

**Update `PBRMaterial` struct in types.h:**
```cpp
struct PBRMaterial {
  // ... existing visual/pricing fields ...

  // Thermal properties
  float thermalConductivity = 0.0f;  // λ in W/(m·K), 0 = unknown
  float thickness = 0.0f;            // Typical thickness in mm (from material)
};
```

**Update materials.json:**
```json
{
  "pine_48x98_c24": {
    "thermal": {
      "conductivity": 0.12,
      "thickness": 98
    }
  },
  "osb_9mm": {
    "thermal": {
      "conductivity": 0.13,
      "thickness": 9
    }
  },
  "insulation_100mm": {
    "thermal": {
      "conductivity": 0.035,
      "thickness": 100
    }
  }
}
```

### Phase 2: Thermal Calculation System (thermal.h/cpp)

**Create `viewer/thermal.h`:**
```cpp
#pragma once

#include "types.h"
#include <vector>

namespace helscoop {

struct ThermalSettings {
  float insideTemp = 20.0f;   // °C
  float outsideTemp = -25.0f; // °C
  float surfaceRInside = 0.13f;  // m²·K/W
  float surfaceROutside = 0.04f; // m²·K/W
};

struct SurfaceThermalData {
  int objectIndex;
  float area_m2;
  float rValue;        // m²·K/W
  float uValue;        // W/(m²·K)
  float heatFlow_W;    // Total heat loss through this surface
  float heatFluxDensity; // W/m² (for color mapping)
  Vector3 normal;      // Heat flow direction (outward = heat loss)
};

struct ThermalAnalysisResult {
  std::vector<SurfaceThermalData> surfaces;
  float totalHeatLoss_W;
  float heatingPower_kW;
  float annualEnergy_kWh; // Approximate (degree-days method)
};

// Calculate thermal properties for all exterior surfaces
ThermalAnalysisResult CalculateThermalLoss(
    const std::vector<ModelWithColor>& models,
    const MaterialLibrary& materials,
    const ThermalSettings& settings);

// Map heat flux to color (blue = low loss, red = high loss)
Color HeatFluxToColor(float heatFlux, float minFlux, float maxFlux);

}  // namespace helscoop
```

**Key functions in `viewer/thermal.cpp`:**
```cpp
float GetMaterialRValue(const PBRMaterial* mat) {
  if (!mat || mat->thermalConductivity <= 0) {
    return 0.5f;  // Default for unknown materials
  }
  return (mat->thickness / 1000.0f) / mat->thermalConductivity;
}

Color HeatFluxToColor(float heatFlux, float minFlux, float maxFlux) {
  // Normalize to 0-1
  float t = (heatFlux - minFlux) / (maxFlux - minFlux);
  t = std::clamp(t, 0.0f, 1.0f);

  // Blue (cold/good insulation) -> Red (hot/poor insulation)
  // Using a temperature color map
  if (t < 0.5f) {
    // Blue to white
    float s = t * 2.0f;
    return Color{
      (unsigned char)(s * 255),
      (unsigned char)(s * 255),
      255,
      255
    };
  } else {
    // White to red
    float s = (t - 0.5f) * 2.0f;
    return Color{
      255,
      (unsigned char)((1.0f - s) * 255),
      (unsigned char)((1.0f - s) * 255),
      255
    };
  }
}
```

### Phase 3: Thermal Visualization Mode

**Add to UIState:**
```cpp
struct UIState {
  // ... existing fields ...
  bool thermalViewEnabled = false;
  ThermalSettings thermalSettings;
  ThermalAnalysisResult thermalResult;
};
```

**Add hotkey 'H' for thermal view toggle:**
```cpp
if (IsKeyPressed(KEY_H)) {
  uiState.thermalViewEnabled = !uiState.thermalViewEnabled;
  if (uiState.thermalViewEnabled) {
    uiState.thermalResult = CalculateThermalLoss(models, materialLib, uiState.thermalSettings);
  }
}
```

**Modify rendering to use thermal colors:**
```cpp
for (size_t i = 0; i < models.size(); i++) {
  Color drawColor = models[i].color;

  if (uiState.thermalViewEnabled) {
    // Find thermal data for this object
    auto it = std::find_if(thermalResult.surfaces.begin(), thermalResult.surfaces.end(),
        [i](const SurfaceThermalData& s) { return s.objectIndex == i; });
    if (it != thermalResult.surfaces.end()) {
      drawColor = HeatFluxToColor(it->heatFluxDensity, minFlux, maxFlux);
    }
  }

  DrawModel(models[i].model, Vector3Zero(), 1.0f, drawColor);
}
```

### Phase 4: Heat Flow Arrows (Optional Enhancement)

Draw arrows on surfaces showing heat flow direction and intensity:

```cpp
void DrawHeatFlowArrows(const ThermalAnalysisResult& result, Camera3D camera) {
  for (const auto& surface : result.surfaces) {
    if (surface.heatFlow_W > 10.0f) {  // Only draw for significant heat loss
      // Arrow length proportional to heat flux
      float arrowLength = surface.heatFluxDensity / 100.0f;  // Scale factor

      Vector3 start = surface.center;
      Vector3 end = Vector3Add(start, Vector3Scale(surface.normal, arrowLength));

      // Red arrow for heat leaving
      DrawLine3D(start, end, RED);
      // Draw arrowhead
      DrawSphere(end, 0.02f, RED);
    }
  }
}
```

### Phase 5: Thermal Analysis Panel

**Add panel showing:**
- Temperature settings (editable sliders)
- Total heat loss (W and kW)
- Breakdown by material/component
- Estimated annual heating cost
- Suggestions for improvement

```
┌─────────────────────────────────┐
│ THERMAL ANALYSIS          [H]  │
├─────────────────────────────────┤
│ Inside:  [  20 ]°C             │
│ Outside: [ -25 ]°C             │
│ ΔT = 45°C                      │
├─────────────────────────────────┤
│ HEAT LOSS BREAKDOWN            │
│ ● Walls:        1,234 W (45%)  │
│ ● Roof:           890 W (32%)  │
│ ● Floor:          234 W  (8%)  │
│ ● Windows:        345 W (12%)  │
│ ● Nest boxes:      89 W  (3%)  │
├─────────────────────────────────┤
│ TOTAL:          2,792 W        │
│ Heating power:    2.8 kW       │
│                                │
│ Annual energy*:  8,400 kWh     │
│ Annual cost*:      €840        │
│ (*at €0.10/kWh, 3000 HDD)     │
└─────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files
- `viewer/thermal.h` - Thermal calculation types and functions
- `viewer/thermal.cpp` - Thermal calculation implementation

### Modified Files
- `viewer/types.h` - Add thermal fields to PBRMaterial
- `viewer/material_loader.cpp` - Parse thermal properties from JSON
- `materials/materials.json` - Add thermal data to materials
- `viewer/main.cpp` - Add thermal view toggle and rendering
- `viewer/ui_panels.h` - Add thermal panel functions
- `viewer/ui_panels.cpp` - Implement thermal panel UI
- `viewer/CMakeLists.txt` - Add thermal.cpp to build

---

## Material Thermal Properties Reference

### Finnish Construction Materials

| Material ID | λ (W/m·K) | Thickness (mm) | R (m²·K/W) |
|-------------|-----------|----------------|------------|
| pine_48x98_c24 | 0.12 | 98 | 0.82 |
| pine_48x148_c24 | 0.12 | 148 | 1.23 |
| pressure_treated_48x148 | 0.12 | 148 | 1.23 |
| osb_9mm | 0.13 | 9 | 0.07 |
| osb_18mm | 0.13 | 18 | 0.14 |
| plywood_9mm_exterior | 0.13 | 9 | 0.07 |
| galvanized_roofing | 50.0 | 0.5 | ~0 |
| galvanized_flashing | 50.0 | 0.5 | ~0 |
| insulation_100mm | 0.035 | 100 | 2.86 |
| vapor_barrier | 0.33 | 0.2 | ~0 |
| nest_box_plywood | 0.13 | 12 | 0.09 |

### Chicken Coop Specific Notes

For a chicken coop at -25°C:
- Chickens generate ~10W of body heat each
- Minimum safe temp for chickens: -20°C (with dry bedding)
- Ventilation needed to control moisture (but loses heat)
- External nest box openings are thermal bridges

The simulation can help decide:
- Whether to add insulation
- Whether external nest box access is worth the heat loss
- Optimal ventilation strategy (heat recovery?)
- Whether supplemental heating is needed

---

## Implementation Order

1. Add thermal properties to `materials.json` and parsing code
2. Create `thermal.h/cpp` with basic R-value calculation
3. Add thermal view toggle (H key) with color-coded surfaces
4. Implement thermal analysis panel with heat loss breakdown
5. (Optional) Add heat flow arrows
6. (Optional) Add temperature sliders to UI

---

## Testing

### Test Scene: Chicken Coop
- Set outside temp to -25°C
- Set inside temp to +5°C (chickens maintain this)
- Verify heat loss calculation matches manual estimate
- Check color gradient shows walls losing more heat than insulated surfaces

### Expected Results
For typical uninsulated chicken coop (approx 3m² walls, 1.5m² roof):
- Wall U-value ≈ 2.0 W/(m²·K) → Q = 2.0 × 3.0 × 30 = 180 W
- Roof U-value ≈ 3.0 W/(m²·K) → Q = 3.0 × 1.5 × 30 = 135 W
- Total ≈ 315 W base heat loss

With 4 chickens generating 40W total, coop might maintain +5°C internally.

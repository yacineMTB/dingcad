# Helscoop Feature Implementation Plan

## Overview

This plan covers four major features:
1. **Toolbar System** - Panel toggle icons at top of screen
2. **Enhanced Thermal** - Weather data integration
3. **Structural Pre-Analysis** - Span checking for lumber
4. **IFC Export** - BIM interoperability

---

## 1. Toolbar System

### Goal
Add a horizontal toolbar at the top of the screen with icon toggles for all panels.

### Current State
- Panels toggled via hotkeys only: [M] Materials, [T] Parameters, [H] Thermal
- No visual indication of panel states
- Hotkeys scattered in main.cpp:387-406

### Implementation

#### 1.1 Add Toolbar to UIState (types.h or ui_panels.h)
```cpp
// Add to UIState struct
struct UIState {
  // ... existing fields ...

  // Toolbar panel toggles (icons)
  bool showToolbar = true;

  // New panels
  bool showStructuralPanel = false;
  bool showExportPanel = false;
};
```

#### 1.2 Create DrawToolbar() Function (ui_panels.cpp)
```cpp
void DrawToolbar(UIState& uiState, const Font& uiFont, int screenWidth) {
  const float toolbarHeight = 40.0f;
  const float toolbarY = 0.0f;
  const float buttonSize = 32.0f;
  const float buttonGap = 8.0f;
  const float startX = 150.0f;  // After branding

  // Semi-transparent background
  DrawRectangle(0, 0, screenWidth, toolbarHeight, Fade(Color{40, 40, 50, 255}, 0.9f));

  float x = startX;

  // Materials toggle [M]
  Rectangle matBtn = {x, 4, buttonSize, buttonSize};
  bool matHovered = CheckCollisionPointRec(GetMousePosition(), matBtn);
  DrawRectangleRec(matBtn, uiState.showMaterialsPanel ? ORANGE : (matHovered ? GRAY : DARKGRAY));
  DrawTextEx(uiFont, "M", {x + 10, 10}, 16, 0, WHITE);
  if (matHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    uiState.showMaterialsPanel = !uiState.showMaterialsPanel;
  }
  x += buttonSize + buttonGap;

  // Parameters toggle [T]
  Rectangle paramBtn = {x, 4, buttonSize, buttonSize};
  bool paramHovered = CheckCollisionPointRec(GetMousePosition(), paramBtn);
  DrawRectangleRec(paramBtn, uiState.showParametersPanel ? ORANGE : (paramHovered ? GRAY : DARKGRAY));
  DrawTextEx(uiFont, "P", {x + 10, 10}, 16, 0, WHITE);
  if (paramHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    uiState.showParametersPanel = !uiState.showParametersPanel;
  }
  x += buttonSize + buttonGap;

  // Thermal toggle [H]
  Rectangle thermalBtn = {x, 4, buttonSize, buttonSize};
  bool thermalHovered = CheckCollisionPointRec(GetMousePosition(), thermalBtn);
  DrawRectangleRec(thermalBtn, uiState.thermalViewEnabled ? RED : (thermalHovered ? GRAY : DARKGRAY));
  DrawTextEx(uiFont, "H", {x + 10, 10}, 16, 0, WHITE);
  if (thermalHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    uiState.thermalViewEnabled = !uiState.thermalViewEnabled;
    uiState.showThermalPanel = uiState.thermalViewEnabled;
  }
  x += buttonSize + buttonGap;

  // Structural toggle [S] (NEW)
  Rectangle structBtn = {x, 4, buttonSize, buttonSize};
  bool structHovered = CheckCollisionPointRec(GetMousePosition(), structBtn);
  DrawRectangleRec(structBtn, uiState.showStructuralPanel ? GREEN : (structHovered ? GRAY : DARKGRAY));
  DrawTextEx(uiFont, "S", {x + 10, 10}, 16, 0, WHITE);
  if (structHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    uiState.showStructuralPanel = !uiState.showStructuralPanel;
  }
  x += buttonSize + buttonGap;

  // Export button [E]
  // ... similar pattern

  // Separator
  x += buttonGap;
  DrawLine(x, 8, x, 32, GRAY);
  x += buttonGap * 2;

  // Status text area (right side)
  // Can show loading state, last action, etc.
}
```

#### 1.3 Update main.cpp
```cpp
// After branding draw (line ~757)
DrawToolbar(uiState, uiFont, screenWidth);

// Adjust panel Y positions to account for toolbar
const float panelYOffset = 45.0f;  // Below toolbar
```

#### 1.4 Files to Modify
- `viewer/ui_panels.h` - Add DrawToolbar declaration
- `viewer/ui_panels.cpp` - Implement DrawToolbar
- `viewer/main.cpp` - Call DrawToolbar, adjust panel positions

---

## 2. Enhanced Thermal with Weather Data

### Goal
Integrate real weather data for accurate annual energy calculations.

### Current State
- Simple static outside temperature slider (-40 to +30°C)
- No seasonal variation
- Monthly cost is just heater power × hours × price

### Implementation

#### 2.1 Add Climate Data Structure (thermal.h)
```cpp
// Climate location with monthly temperature data
struct ClimateLocation {
  std::string name;           // e.g., "Helsinki, Finland"
  std::string code;           // e.g., "FI-HEL"
  float latitude;
  float longitude;

  // Monthly average temperatures (°C) - Jan to Dec
  std::array<float, 12> monthlyAvgTemp;

  // Heating degree days (base 17°C)
  float annualHDD;

  // Design temperature (coldest expected)
  float designTemp;
};

// Extend ThermalSettings
struct ThermalSettings {
  // ... existing fields ...

  // Climate data
  int selectedLocationIndex = 0;  // Index into climate locations
  bool useMonthlyData = true;     // Use monthly vs. static temp
  int displayMonth = 0;           // 0-11, for monthly view

  // Target inside temperature
  float targetInsideTemp = 5.0f;  // Desired minimum temp
};

// Extend ThermalAnalysisResult
struct ThermalAnalysisResult {
  // ... existing fields ...

  // Annual calculations
  std::array<float, 12> monthlyHeatLoss_kWh;
  std::array<float, 12> monthlyHeatingCost_EUR;
  float annualHeatingCost_EUR;
  float annualHeatLoss_kWh;
};
```

#### 2.2 Create Climate Database (climate_data.cpp)
```cpp
// Embedded climate data for Nordic locations
static const std::vector<ClimateLocation> kClimateLocations = {
  {
    "Helsinki, Finland", "FI-HEL", 60.17, 24.94,
    {-4.7, -5.1, -1.5, 4.3, 10.5, 14.9, 17.6, 16.2, 11.2, 5.8, 1.0, -2.5},
    4500, // HDD
    -26.0 // Design temp
  },
  {
    "Oulu, Finland", "FI-OUL", 65.01, 25.47,
    {-10.2, -9.6, -5.0, 1.5, 8.0, 13.5, 16.5, 14.2, 9.0, 3.0, -3.5, -7.5},
    5500,
    -32.0
  },
  {
    "Rovaniemi, Finland", "FI-ROV", 66.50, 25.73,
    {-13.0, -11.5, -6.5, -0.5, 6.5, 12.5, 15.0, 12.5, 7.0, 1.0, -5.5, -10.5},
    6200,
    -38.0
  },
  {
    "Stockholm, Sweden", "SE-STO", 59.33, 18.07,
    {-1.6, -2.0, 1.0, 5.5, 11.0, 15.5, 18.0, 17.0, 12.5, 7.5, 3.0, 0.0},
    3900,
    -18.0
  },
  // Add more locations...
};
```

#### 2.3 Update Thermal Calculations (thermal.cpp)
```cpp
// Calculate monthly and annual heating needs
void CalculateAnnualThermal(
    ThermalAnalysisResult& result,
    const ThermalSettings& settings,
    const ClimateLocation& climate) {

  result.annualHeatLoss_kWh = 0.0f;
  result.annualHeatingCost_EUR = 0.0f;

  const float hoursPerMonth = 730.0f;  // Average

  for (int month = 0; month < 12; ++month) {
    float outsideTemp = climate.monthlyAvgTemp[month];
    float deltaT = std::max(0.0f, settings.targetInsideTemp - outsideTemp);

    // Heat loss this month (W → kWh)
    float heatLoss_W = result.totalUA * deltaT;
    float heatLoss_kWh = (heatLoss_W * hoursPerMonth) / 1000.0f;

    // Subtract heat from chickens (if enabled)
    float chickenHeat_kWh = 0.0f;
    if (settings.chickensEnabled) {
      chickenHeat_kWh = (settings.chickenCount * settings.heatPerChicken_W * hoursPerMonth) / 1000.0f;
    }

    // Net heating needed
    float heatingNeeded_kWh = std::max(0.0f, heatLoss_kWh - chickenHeat_kWh);

    result.monthlyHeatLoss_kWh[month] = heatingNeeded_kWh;
    result.monthlyHeatingCost_EUR[month] = heatingNeeded_kWh * settings.electricityPrice_cPerKwh / 100.0f;

    result.annualHeatLoss_kWh += heatingNeeded_kWh;
    result.annualHeatingCost_EUR += result.monthlyHeatingCost_EUR[month];
  }
}
```

#### 2.4 Update Thermal Panel UI (ui_panels.cpp)
Add to DrawThermalPanel:
```cpp
// Location selector dropdown
DrawTextEx(uiFont, "LOCATION", {panelX + 10, yPos}, 10, 0, DARKGRAY);
yPos += 14;

// Simple location buttons (or dropdown in future)
for (size_t i = 0; i < kClimateLocations.size() && i < 4; ++i) {
  Rectangle locBtn = {panelX + 10 + i * 80, yPos, 75, 18};
  bool selected = (settings.selectedLocationIndex == i);
  bool hovered = CheckCollisionPointRec(GetMousePosition(), locBtn);

  DrawRectangleRec(locBtn, selected ? BLUE : (hovered ? GRAY : DARKGRAY));
  DrawTextEx(uiFont, kClimateLocations[i].code.c_str(),
             {locBtn.x + 5, locBtn.y + 2}, 10, 0, WHITE);

  if (hovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    settings.selectedLocationIndex = i;
    settingsChanged = true;
  }
}
yPos += 24;

// Monthly temperature bar chart
DrawTextEx(uiFont, "MONTHLY TEMPS", {panelX + 10, yPos}, 10, 0, DARKGRAY);
yPos += 14;

const auto& loc = kClimateLocations[settings.selectedLocationIndex];
float barWidth = (panelWidth - 40) / 12.0f;
for (int m = 0; m < 12; ++m) {
  float temp = loc.monthlyAvgTemp[m];
  float barHeight = std::abs(temp) * 2.0f;  // Scale
  float barY = yPos + 30 - (temp > 0 ? barHeight : 0);

  Color barColor = temp < 0 ? SKYBLUE : (temp < 10 ? YELLOW : GREEN);
  DrawRectangle(panelX + 15 + m * barWidth, barY, barWidth - 2, barHeight, barColor);
}
// Zero line
DrawLine(panelX + 10, yPos + 30, panelX + panelWidth - 10, yPos + 30, WHITE);
yPos += 50;

// Annual summary
char annualText[64];
snprintf(annualText, sizeof(annualText), "ANNUAL: %.0f kWh = %.0f EUR",
         thermalResult.annualHeatLoss_kWh, thermalResult.annualHeatingCost_EUR);
DrawTextEx(uiFont, annualText, {panelX + 10, yPos}, 14, 0,
           thermalResult.annualHeatingCost_EUR > 100 ? ORANGE : GREEN);
```

#### 2.5 Files to Modify/Create
- `viewer/climate_data.h` - Climate location structs and data (NEW)
- `viewer/climate_data.cpp` - Embedded climate database (NEW)
- `viewer/thermal.h` - Extend structs
- `viewer/thermal.cpp` - Add annual calculations
- `viewer/ui_panels.cpp` - Update thermal panel UI
- `viewer/CMakeLists.txt` - Add new source files

---

## 3. Structural Pre-Analysis

### Goal
Add basic span checking to flag undersized structural members.

### Current State
- Materials have thermal properties but no structural properties
- No span tables or load calculations
- No visual feedback for structural issues

### Implementation

#### 3.1 Add Structural Properties to Materials (materials.json)
```json
{
  "pine_48x98_c24": {
    "structural": {
      "gradeClass": "C24",
      "maxSpan_floor_mm": 2400,
      "maxSpan_wall_mm": 3000,
      "maxSpan_rafter_mm": 2000,
      "loadCapacity_kN_m": 5.0,
      "bendingStrength_MPa": 24.0,
      "modulus_GPa": 11.0
    }
  },
  "pine_48x148_c24": {
    "structural": {
      "gradeClass": "C24",
      "maxSpan_floor_mm": 3600,
      "maxSpan_wall_mm": 4500,
      "maxSpan_rafter_mm": 3000,
      "loadCapacity_kN_m": 8.0,
      "bendingStrength_MPa": 24.0,
      "modulus_GPa": 11.0
    }
  }
}
```

#### 3.2 Add Structural Types (types.h)
```cpp
// Structural properties for lumber
struct PBRStructural {
  std::string gradeClass;      // e.g., "C24"
  float maxSpan_floor_mm = 0;  // Max span as floor joist
  float maxSpan_wall_mm = 0;   // Max span as wall stud
  float maxSpan_rafter_mm = 0; // Max span as rafter
  float loadCapacity_kN_m = 0; // Load capacity per meter
  float bendingStrength_MPa = 0;
  float modulus_GPa = 0;
};

// Extend PBRMaterial
struct PBRMaterial {
  // ... existing fields ...
  PBRStructural structural;
};

// Structural check result
struct StructuralCheck {
  std::string memberName;
  std::string materialId;
  float actualSpan_mm;
  float maxAllowedSpan_mm;
  bool isOversized;  // true = needs bigger lumber
  std::string suggestedMaterial;  // Recommended upgrade
};

struct StructuralAnalysisResult {
  std::vector<StructuralCheck> checks;
  int warningCount = 0;
  int errorCount = 0;
  bool allPassed = true;
};
```

#### 3.3 Create Structural Analysis (structural.cpp)
```cpp
#include "structural.h"
#include "material_loader.h"

namespace helscoop {

StructuralAnalysisResult AnalyzeStructure(
    const std::vector<ModelWithColor>& models,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const SceneData& sceneData) {

  StructuralAnalysisResult result;

  // For each lumber object, check if span exceeds limit
  // This requires knowing the span - which we'd need to extract from geometry
  // For now, we can use a simplified approach based on bounding box

  for (size_t i = 0; i < models.size(); ++i) {
    const auto& model = models[i];
    if (model.materialId.empty()) continue;

    const PBRMaterial* mat = library.get(model.materialId);
    if (!mat || mat->category != "lumber") continue;

    // Get bounding box to estimate span
    BoundingBox bbox = GetModelBoundingBox(model.model);
    float length = std::max({
      bbox.max.x - bbox.min.x,
      bbox.max.y - bbox.min.y,
      bbox.max.z - bbox.min.z
    }) * 1000.0f / kSceneScale;  // Convert to mm

    // Determine member type by orientation
    // (simplified: horizontal members are joists/rafters, vertical are studs)
    float height = (bbox.max.y - bbox.min.y) * 1000.0f / kSceneScale;
    bool isVertical = height > length * 0.8f;

    float maxSpan = isVertical
      ? mat->structural.maxSpan_wall_mm
      : mat->structural.maxSpan_floor_mm;

    if (maxSpan > 0 && length > maxSpan) {
      StructuralCheck check;
      check.memberName = mat->name;
      check.materialId = model.materialId;
      check.actualSpan_mm = length;
      check.maxAllowedSpan_mm = maxSpan;
      check.isOversized = true;
      check.suggestedMaterial = FindSuitableMaterial(library, length, isVertical);

      result.checks.push_back(check);
      result.warningCount++;
      result.allPassed = false;
    }
  }

  return result;
}

std::string FindSuitableMaterial(
    const MaterialLibrary& library,
    float requiredSpan_mm,
    bool isVertical) {

  float bestSpan = 0;
  std::string bestMaterial;

  for (const auto& [id, mat] : library.materials) {
    if (mat.category != "lumber") continue;

    float maxSpan = isVertical
      ? mat.structural.maxSpan_wall_mm
      : mat.structural.maxSpan_floor_mm;

    if (maxSpan >= requiredSpan_mm && (bestSpan == 0 || maxSpan < bestSpan)) {
      bestSpan = maxSpan;
      bestMaterial = mat.name;
    }
  }

  return bestMaterial.empty() ? "Consider engineered lumber" : bestMaterial;
}

}  // namespace helscoop
```

#### 3.4 Create Structural Panel UI (ui_panels.cpp)
```cpp
void DrawStructuralPanel(
    const StructuralAnalysisResult& structResult,
    UIState& uiState,
    const Font& uiFont,
    int screenWidth, int screenHeight) {

  const float panelWidth = 320.0f;
  const float panelX = static_cast<float>(screenWidth) - panelWidth - 10.0f - 290.0f;  // Left of parameters
  const float panelY = 50.0f;
  const float panelHeight = 300.0f;

  // Panel background
  DrawRectangle(panelX, panelY, panelWidth, panelHeight, Fade(Color{30, 40, 30, 255}, 0.95f));
  DrawRectangleLines(panelX, panelY, panelWidth, panelHeight, DARKGRAY);

  float yPos = panelY + 10;

  // Title with status
  Color titleColor = structResult.allPassed ? GREEN : (structResult.errorCount > 0 ? RED : ORANGE);
  DrawTextEx(uiFont, "STRUCTURAL CHECK", {panelX + 10, yPos}, 16, 0, titleColor);
  yPos += 24;

  // Summary
  char summaryText[64];
  if (structResult.allPassed) {
    snprintf(summaryText, sizeof(summaryText), "All members OK");
    DrawTextEx(uiFont, summaryText, {panelX + 10, yPos}, 12, 0, GREEN);
  } else {
    snprintf(summaryText, sizeof(summaryText), "%d warnings, %d errors",
             structResult.warningCount, structResult.errorCount);
    DrawTextEx(uiFont, summaryText, {panelX + 10, yPos}, 12, 0, ORANGE);
  }
  yPos += 20;

  DrawLine(panelX + 5, yPos, panelX + panelWidth - 5, yPos, GRAY);
  yPos += 8;

  // List issues
  for (const auto& check : structResult.checks) {
    if (yPos > panelY + panelHeight - 40) break;

    // Member name
    DrawTextEx(uiFont, check.memberName.c_str(), {panelX + 10, yPos}, 11, 0, WHITE);
    yPos += 14;

    // Span info
    char spanText[80];
    snprintf(spanText, sizeof(spanText), "  Span: %.0fmm (max %.0fmm)",
             check.actualSpan_mm, check.maxAllowedSpan_mm);
    DrawTextEx(uiFont, spanText, {panelX + 10, yPos}, 10, 0, RED);
    yPos += 12;

    // Suggestion
    char suggestText[80];
    snprintf(suggestText, sizeof(suggestText), "  -> %s", check.suggestedMaterial.c_str());
    DrawTextEx(uiFont, suggestText, {panelX + 10, yPos}, 10, 0, YELLOW);
    yPos += 16;
  }

  // Hotkey hint
  DrawTextEx(uiFont, "[S] TOGGLE", {panelX + 10, panelY + panelHeight - 18}, 10, 0, GRAY);
}
```

#### 3.5 Files to Modify/Create
- `viewer/structural.h` - Structural analysis types (NEW)
- `viewer/structural.cpp` - Span checking logic (NEW)
- `viewer/types.h` - Add PBRStructural
- `viewer/ui_panels.h` - Add DrawStructuralPanel
- `viewer/ui_panels.cpp` - Implement DrawStructuralPanel
- `viewer/material_loader.cpp` - Parse structural properties from JSON
- `viewer/main.cpp` - Integrate structural analysis
- `materials/materials.json` - Add structural properties
- `viewer/CMakeLists.txt` - Add new source files

---

## 4. IFC Export

### Goal
Export scenes to IFC-SPF format for BIM interoperability.

### Current State
- Only STL export (mesh geometry, no semantics)
- No IFC support

### Implementation

#### 4.1 IFC Export Types (ifc_export.h)
```cpp
#pragma once

#include "types.h"
#include <filesystem>
#include <string>
#include <vector>

namespace helscoop {

// IFC entity types we'll support
enum class IfcEntityType {
  Wall,
  Slab,        // Floor/roof
  Column,
  Beam,
  BuildingElementProxy  // Generic fallback
};

// Mapping from material category to IFC type
IfcEntityType CategoryToIfcType(const std::string& category);

// Export scene to IFC-SPF format
bool ExportToIFC(
    const SceneData& sceneData,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const std::filesystem::path& outputPath,
    std::string& errorMsg);

// Generate unique IFC GUID
std::string GenerateIfcGuid();

}  // namespace helscoop
```

#### 4.2 IFC Export Implementation (ifc_export.cpp)
```cpp
#include "ifc_export.h"
#include <fstream>
#include <sstream>
#include <chrono>
#include <random>

namespace helscoop {

// Category to IFC entity type mapping
IfcEntityType CategoryToIfcType(const std::string& category) {
  if (category == "lumber" || category == "sheathing") return IfcEntityType::Wall;
  if (category == "roofing") return IfcEntityType::Slab;
  if (category == "masonry") return IfcEntityType::BuildingElementProxy;
  if (category == "insulation") return IfcEntityType::BuildingElementProxy;
  return IfcEntityType::BuildingElementProxy;
}

std::string GenerateIfcGuid() {
  // IFC uses base64-encoded 128-bit GUIDs
  static std::random_device rd;
  static std::mt19937 gen(rd());
  static std::uniform_int_distribution<uint64_t> dist;

  // Generate 22-character base64 string (simplified)
  const char* chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  std::string guid;
  for (int i = 0; i < 22; ++i) {
    guid += chars[dist(gen) % 64];
  }
  return guid;
}

bool ExportToIFC(
    const SceneData& sceneData,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const std::filesystem::path& outputPath,
    std::string& errorMsg) {

  std::ofstream file(outputPath);
  if (!file.is_open()) {
    errorMsg = "Failed to open file: " + outputPath.string();
    return false;
  }

  // Get current timestamp
  auto now = std::chrono::system_clock::now();
  auto time = std::chrono::system_clock::to_time_t(now);
  std::tm* tm = std::localtime(&time);
  char timestamp[64];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S", tm);

  // IFC HEADER
  file << "ISO-10303-21;\n";
  file << "HEADER;\n";
  file << "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n";
  file << "FILE_NAME('" << outputPath.filename().string() << "','" << timestamp << "',";
  file << "('Helscoop'),(''),''," << "'Helscoop','');\n";
  file << "FILE_SCHEMA(('IFC4'));\n";
  file << "ENDSEC;\n";
  file << "DATA;\n";

  int entityId = 1;

  // Basic required entities
  std::string orgGuid = GenerateIfcGuid();
  std::string personGuid = GenerateIfcGuid();
  std::string appGuid = GenerateIfcGuid();
  std::string ownerGuid = GenerateIfcGuid();

  // #1 = Organization
  file << "#" << entityId++ << " = IFCORGANIZATION($,'Helscoop',$,$,$);\n";
  // #2 = Person
  file << "#" << entityId++ << " = IFCPERSON($,$,$,$,$,$,$,$);\n";
  // #3 = PersonAndOrganization
  file << "#" << entityId++ << " = IFCPERSONANDORGANIZATION(#2,#1,$);\n";
  // #4 = Application
  file << "#" << entityId++ << " = IFCAPPLICATION(#1,'1.0','Helscoop','Helscoop');\n";
  // #5 = OwnerHistory
  file << "#" << entityId++ << " = IFCOWNERHISTORY(#3,#4,$,.NOCHANGE.,$,$,$," << time << ");\n";

  int ownerHistoryId = entityId - 1;

  // Geometric context
  // #6 = Direction (Z up)
  file << "#" << entityId++ << " = IFCDIRECTION((0.,0.,1.));\n";
  int zAxisId = entityId - 1;
  // #7 = Direction (X)
  file << "#" << entityId++ << " = IFCDIRECTION((1.,0.,0.));\n";
  int xAxisId = entityId - 1;
  // #8 = CartesianPoint (origin)
  file << "#" << entityId++ << " = IFCCARTESIANPOINT((0.,0.,0.));\n";
  int originId = entityId - 1;
  // #9 = Axis2Placement3D
  file << "#" << entityId++ << " = IFCAXIS2PLACEMENT3D(#" << originId << ",#" << zAxisId << ",#" << xAxisId << ");\n";
  int placementId = entityId - 1;
  // #10 = GeometricRepresentationContext
  file << "#" << entityId++ << " = IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#" << placementId << ",$);\n";
  int contextId = entityId - 1;

  // Project
  file << "#" << entityId++ << " = IFCPROJECT('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Helscoop Export',$,$,$,$,(#" << contextId << "),$);\n";
  int projectId = entityId - 1;

  // Site
  file << "#" << entityId++ << " = IFCSITE('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Site',$,$,#" << placementId << ",$,$,.ELEMENT.,$,$,$,$,$);\n";
  int siteId = entityId - 1;

  // Building
  file << "#" << entityId++ << " = IFCBUILDING('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Building',$,$,#" << placementId << ",$,$,.ELEMENT.,$,$,$);\n";
  int buildingId = entityId - 1;

  // Building Storey (floor level)
  file << "#" << entityId++ << " = IFCBUILDINGSTOREY('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Ground Floor',$,$,#" << placementId << ",$,$,.ELEMENT.,0.);\n";
  int storeyId = entityId - 1;

  // Spatial hierarchy
  file << "#" << entityId++ << " = IFCRELAGGREGATES('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",$,$,#" << projectId << ",(#" << siteId << "));\n";
  file << "#" << entityId++ << " = IFCRELAGGREGATES('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",$,$,#" << siteId << ",(#" << buildingId << "));\n";
  file << "#" << entityId++ << " = IFCRELAGGREGATES('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",$,$,#" << buildingId << ",(#" << storeyId << "));\n";

  // Export each object as building element
  std::vector<int> elementIds;

  for (size_t i = 0; i < sceneData.objects.size(); ++i) {
    const auto& obj = sceneData.objects[i];
    if (!obj.geometry) continue;

    // Get material info
    const PBRMaterial* mat = nullptr;
    if (!obj.materialId.empty()) {
      mat = library.get(obj.materialId);
    }

    std::string name = mat ? mat->name : ("Element_" + std::to_string(i));
    std::string category = mat ? mat->category : "unknown";
    IfcEntityType ifcType = CategoryToIfcType(category);

    // Get bounding box for simplified geometry
    // (Full BREP export would require more complex mesh triangulation)
    auto mesh = obj.geometry->GetMesh();
    if (mesh.vertPos.empty()) continue;

    float minX = std::numeric_limits<float>::max();
    float minY = std::numeric_limits<float>::max();
    float minZ = std::numeric_limits<float>::max();
    float maxX = std::numeric_limits<float>::lowest();
    float maxY = std::numeric_limits<float>::lowest();
    float maxZ = std::numeric_limits<float>::lowest();

    for (size_t v = 0; v < mesh.vertPos.size(); v += 3) {
      minX = std::min(minX, mesh.vertPos[v]);
      maxX = std::max(maxX, mesh.vertPos[v]);
      minY = std::min(minY, mesh.vertPos[v + 1]);
      maxY = std::max(maxY, mesh.vertPos[v + 1]);
      minZ = std::min(minZ, mesh.vertPos[v + 2]);
      maxZ = std::max(maxZ, mesh.vertPos[v + 2]);
    }

    float sizeX = (maxX - minX) / kSceneScale;
    float sizeY = (maxY - minY) / kSceneScale;
    float sizeZ = (maxZ - minZ) / kSceneScale;
    float centerX = (minX + maxX) / 2.0f / kSceneScale;
    float centerY = (minY + maxY) / 2.0f / kSceneScale;
    float centerZ = (minZ + maxZ) / 2.0f / kSceneScale;

    // Create bounding box representation
    // CartesianPoint for center
    file << "#" << entityId++ << " = IFCCARTESIANPOINT((" << centerX << "," << centerZ << "," << centerY << "));\n";
    int boxCenterId = entityId - 1;

    // Local placement
    file << "#" << entityId++ << " = IFCAXIS2PLACEMENT3D(#" << boxCenterId << ",$,$);\n";
    int localPlacementAxisId = entityId - 1;
    file << "#" << entityId++ << " = IFCLOCALPLACEMENT(#" << placementId << ",#" << localPlacementAxisId << ");\n";
    int localPlacementId = entityId - 1;

    // Bounding box (simplified geometry)
    file << "#" << entityId++ << " = IFCBOUNDINGBOX(#" << originId << "," << sizeX << "," << sizeZ << "," << sizeY << ");\n";
    int bboxId = entityId - 1;

    // Shape representation
    file << "#" << entityId++ << " = IFCSHAPEREPRESENTATION(#" << contextId << ",'Box','BoundingBox',(#" << bboxId << "));\n";
    int shapeRepId = entityId - 1;
    file << "#" << entityId++ << " = IFCPRODUCTDEFINITIONSHAPE($,$,(#" << shapeRepId << "));\n";
    int productShapeId = entityId - 1;

    // Building element based on type
    const char* ifcTypeName;
    switch (ifcType) {
      case IfcEntityType::Wall: ifcTypeName = "IFCWALL"; break;
      case IfcEntityType::Slab: ifcTypeName = "IFCSLAB"; break;
      case IfcEntityType::Column: ifcTypeName = "IFCCOLUMN"; break;
      case IfcEntityType::Beam: ifcTypeName = "IFCBEAM"; break;
      default: ifcTypeName = "IFCBUILDINGELEMENTPROXY"; break;
    }

    file << "#" << entityId++ << " = " << ifcTypeName << "('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
    file << ",'" << name << "',$,$,#" << localPlacementId << ",#" << productShapeId << ",$";
    if (ifcType == IfcEntityType::Slab) {
      file << ",.FLOOR.";  // Slab predefined type
    }
    file << ");\n";

    elementIds.push_back(entityId - 1);
  }

  // Relate elements to storey
  if (!elementIds.empty()) {
    file << "#" << entityId++ << " = IFCRELCONTAINEDINSPATIALSTRUCTURE('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
    file << ",$,$,(";
    for (size_t i = 0; i < elementIds.size(); ++i) {
      if (i > 0) file << ",";
      file << "#" << elementIds[i];
    }
    file << "),#" << storeyId << ");\n";
  }

  file << "ENDSEC;\n";
  file << "END-ISO-10303-21;\n";

  file.close();
  return true;
}

}  // namespace helscoop
```

#### 4.3 Add Export Button/UI (main.cpp)
```cpp
// In export handling section (~line 425)
// Add IFC export alongside STL
if (IsKeyPressed(KEY_I) && !sceneData.objects.empty()) {
  std::filesystem::path downloads;
  if (const char* home = std::getenv("HOME")) {
    downloads = std::filesystem::path(home) / "Downloads";
  } else {
    downloads = std::filesystem::current_path();
  }

  std::filesystem::path ifcPath = downloads / "ding.ifc";
  std::string error;
  if (ExportToIFC(sceneData, sceneMaterials, g_materialLibrary, ifcPath, error)) {
    reportStatus("Saved " + ifcPath.string());
  } else {
    reportStatus("IFC export failed: " + error);
  }
}
```

#### 4.4 Files to Create/Modify
- `viewer/ifc_export.h` - IFC export declarations (NEW)
- `viewer/ifc_export.cpp` - IFC-SPF generation (NEW)
- `viewer/main.cpp` - Add IFC export hotkey [I]
- `viewer/ui_panels.cpp` - Add IFC button to toolbar/export panel
- `viewer/CMakeLists.txt` - Add new source files

---

## Implementation Order

### Phase 1: Toolbar (1-2 hours)
1. Add toolbar to ui_panels.cpp
2. Update main.cpp to call DrawToolbar
3. Adjust panel Y positions
4. Test panel toggles work via toolbar and hotkeys

### Phase 2: Enhanced Thermal (2-3 hours)
1. Create climate_data.h/cpp with Nordic locations
2. Extend ThermalSettings and ThermalAnalysisResult
3. Implement CalculateAnnualThermal
4. Update thermal panel UI with location selector and annual stats
5. Test with different locations

### Phase 3: Structural Pre-Analysis (2-3 hours)
1. Add structural properties to materials.json
2. Create structural.h/cpp with span checking
3. Update material_loader to parse structural data
4. Create structural panel UI
5. Integrate into main loop
6. Test with oversized spans

### Phase 4: IFC Export (3-4 hours)
1. Create ifc_export.h/cpp
2. Implement basic IFC-SPF header and project structure
3. Map categories to IFC types
4. Export geometry as bounding boxes (simplified)
5. Add export hotkey/button
6. Test opening in IFC viewer (e.g., BIM Vision, xBIM)

---

## Testing Checklist

### Toolbar
- [ ] All buttons visible at top
- [ ] Click toggles panel visibility
- [ ] Hotkeys still work
- [ ] Active state shown with color

### Enhanced Thermal
- [ ] Location selector works
- [ ] Monthly temps display correctly
- [ ] Annual kWh and EUR calculated
- [ ] Changes location updates all values

### Structural
- [ ] Undersized members flagged red
- [ ] Suggestion shows correct larger size
- [ ] All-green when spans OK
- [ ] Panel toggle works

### IFC Export
- [ ] File created in Downloads
- [ ] Opens in BIM Vision without errors
- [ ] All objects visible
- [ ] Materials names preserved

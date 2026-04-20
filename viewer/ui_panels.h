#pragma once

#include "types.h"
#include "thermal.h"
#include "structural.h"
#include "assembly.h"
#include "raylib.h"

#include <filesystem>
#include <string>
#include <vector>

namespace helscoop {

// Panel position for draggable panels
struct PanelPos {
  float x = 0.0f;
  float y = 0.0f;
  bool initialized = false;
};

// UI state container
struct UIState {
  bool showParametersPanel = true;
  bool showMaterialsPanel = true;
  bool showThermalPanel = false;
  bool showStructuralPanel = false;
  bool thermalViewEnabled = false;
  bool liveUpdatesEnabled = true;
  int draggingParamIndex = -1;
  float draggingStartValue = 0.0f;

  // Toolbar (always visible)
  bool showToolbar = true;

  // Material hover/selection state
  std::string hoveredMaterialId;   // Material being hovered in panel
  std::string selectedMaterialId;  // Material clicked/selected (persistent)
  std::string hoveredPartMaterialId;  // Part being hovered in assembly panel (for cross-highlighting)

  // Scroll offsets for panels
  float materialScrollOffset = 0.0f;
  float parameterScrollOffset = 0.0f;

  // Material search/filter
  char materialFilterText[64] = "";
  bool materialFilterActive = false;

  // Thermal settings (user-adjustable)
  ThermalSettings thermalSettings;

  // Draggable panel positions
  PanelPos materialsPos;
  PanelPos parametersPos;
  PanelPos thermalPos;
  PanelPos structuralPos;

  // Panel dragging state
  int draggingPanel = -1;  // -1=none, 0=materials, 1=params, 2=thermal, 3=structural, 4=assembly, 5=lighting
  Vector2 dragOffset = {0, 0};

  // Assembly preview state
  bool showAssemblyPanel = false;
  int currentAssemblyStep = 0;  // Current step being viewed (0-indexed)
  PanelPos assemblyPos;

  // Lighting panel state
  bool showLightingPanel = false;
  PanelPos lightingPos;
  LightingSettings lightingSettings;

  // Export button clicks (set by toolbar, cleared by main after handling)
  bool stlExportClicked = false;
  bool ifcExportClicked = false;
  bool svgExportClicked = false;
  bool bomExportClicked = false;
  bool instructionsExportClicked = false;
};

// Draw materials panel on left side (updates uiState.hoveredMaterialId)
// Optional assemblyFilter: when non-empty, only shows materials in that list
void DrawMaterialsPanel(const std::vector<MaterialItem>& materials,
                        UIState& uiState,
                        const Font& uiFont,
                        int screenWidth, int screenHeight,
                        const std::vector<std::string>& assemblyFilter = {});

// Draw parameters panel on right side (returns true if a parameter was modified)
bool DrawParametersPanel(std::vector<SceneParameter>& parameters,
                         UIState& state,
                         const Font& uiFont,
                         int screenWidth, int screenHeight,
                         const std::filesystem::path& scriptPath);

// Check if mouse is over any UI panel
bool IsMouseOverPanels(const std::vector<MaterialItem>& materials,
                       const std::vector<SceneParameter>& parameters,
                       bool showMaterialsPanel,
                       bool showParametersPanel,
                       int screenWidth, int screenHeight);

// Draw thermal analysis panel (bottom left when enabled)
// Returns true if thermal settings were modified (need recalculation)
bool DrawThermalPanel(const ThermalAnalysisResult& thermalResult,
                      UIState& uiState,
                      const Font& uiFont,
                      int screenWidth, int screenHeight);

// Draw a color scale legend for thermal view
void DrawThermalLegend(float minFlux, float maxFlux,
                       const Font& uiFont,
                       int screenWidth, int screenHeight);

// Draw structural analysis panel
void DrawStructuralPanel(const StructuralAnalysisResult& structResult,
                         UIState& uiState,
                         const Font& uiFont,
                         int screenWidth, int screenHeight);

// Draw assembly preview panel (IKEA-style step-by-step view)
// Returns true if the step was changed (so main can update visible objects)
bool DrawAssemblyPanel(const AssemblyInstructions& assembly,
                       UIState& uiState,
                       const Font& uiFont,
                       int screenWidth, int screenHeight);

// Draw lighting control panel
// Returns true if any lighting setting was modified
bool DrawLightingPanel(UIState& uiState,
                       std::vector<Spotlight>& spotlights,
                       const Font& uiFont,
                       int screenWidth, int screenHeight);

// Draw toolbar at top of screen with panel toggles
// Returns true if any toggle was clicked (for status updates)
bool DrawToolbar(UIState& uiState,
                 const Font& uiFont,
                 int screenWidth,
                 const std::string& statusMessage,
                 float brandWidth = 145.0f);

// Toolbar height constant for panel positioning
inline constexpr float kToolbarHeight = 42.0f;

}  // namespace helscoop

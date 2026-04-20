#pragma once

#include "types.h"
#include "assembly.h"

#include <filesystem>
#include <string>
#include <vector>

namespace helscoop {

// Blueprint export options
struct BlueprintOptions {
  bool includeTopView = true;
  bool includeFrontView = true;
  bool includeSideView = true;
  bool includeDimensions = true;
  bool includePartsList = true;
  float scale = 1.0f;  // 1:1 scale, can be 0.5 for 1:2, etc.
  float pageWidth = 841.0f;   // A1 landscape width in mm
  float pageHeight = 594.0f;  // A1 landscape height in mm
  float margin = 20.0f;       // Page margin in mm
};

// Export scene to SVG blueprint with orthographic views
bool ExportToSVG(
    const SceneData& sceneData,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const std::filesystem::path& outputPath,
    const BlueprintOptions& options,
    std::string& errorMsg);

// Export parts list / cut list to CSV
bool ExportPartsList(
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const std::filesystem::path& outputPath,
    std::string& errorMsg);

// Export IKEA-style assembly instructions (multi-page SVG with step-by-step views)
bool ExportAssemblyInstructions(
    const SceneData& sceneData,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const AssemblyInstructions& assembly,
    const std::filesystem::path& outputDir,
    std::string& errorMsg);

}  // namespace helscoop

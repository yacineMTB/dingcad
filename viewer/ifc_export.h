#pragma once

#include "types.h"

#include <filesystem>
#include <string>
#include <vector>

namespace helscoop {

// IFC entity types we support
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

// Generate unique IFC GUID (22-character base64)
std::string GenerateIfcGuid();

}  // namespace helscoop

#pragma once

#include "types.h"

#include <filesystem>
#include <optional>

namespace helscoop {

// Load material library from JSON file
std::optional<MaterialLibrary> LoadMaterialLibrary(const std::filesystem::path& jsonPath);

// Get default material library path relative to executable
std::filesystem::path GetDefaultMaterialLibraryPath();

// Global material library (loaded once at startup)
extern MaterialLibrary g_materialLibrary;

// Initialize global material library
bool InitMaterialLibrary(const std::filesystem::path& basePath);

// Load textures for all materials that have texture paths
// Must be called from main thread after OpenGL is initialized
void LoadMaterialTextures();

// Unload all loaded textures
void UnloadMaterialTextures();

}  // namespace helscoop

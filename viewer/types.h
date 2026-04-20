#pragma once

#include "raylib.h"
#include "manifold/manifold.h"
#include "assembly.h"

#include <array>
#include <cctype>
#include <filesystem>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <unordered_map>
#include <vector>

namespace helscoop {

// UI constants
inline const Color kBaseColor = {210, 210, 220, 255};
inline const char* kBrandText = "HELSCOOP";
inline constexpr float kBrandFontSize = 34.0f;
inline constexpr int kUIFontSize = 48;
inline constexpr float kSceneScale = 0.1f;

// Helper to convert string to uppercase
inline std::string toUpper(const std::string& s) {
  std::string result = s;
  for (char& c : result) {
    c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
  }
  return result;
}

// Simple 3D vector for mesh operations
struct Vec3f {
  float x, y, z;
};

// Spotlight placed by user at camera position
struct Spotlight {
  Vector3 position;
  Vector3 direction;
  float intensity = 5.0f;
  float innerCone = 15.0f;  // degrees
  float outerCone = 30.0f;  // degrees
  Color color = WHITE;
};

// Lighting and render settings (controlled via Lighting panel)
struct LightingSettings {
  // Render mode
  bool pbrModeEnabled = true;  // false = toon shading

  // Ambient light
  float ambientIntensity = 0.15f;  // 0.0-1.0
  std::array<float, 3> ambientColor = {0.6f, 0.7f, 1.0f};  // Sky blue tint

  // Main directional light (sun)
  float sunIntensity = 1.0f;
  std::array<float, 3> sunColor = {1.0f, 0.95f, 0.9f};  // Warm white
  float sunAzimuth = 45.0f;    // Horizontal angle in degrees
  float sunElevation = 45.0f;  // Vertical angle in degrees

  // Secondary fill light
  float fillIntensity = 0.3f;
  std::array<float, 3> fillColor = {0.7f, 0.8f, 1.0f};  // Cool blue

  // Shadows
  bool shadowsEnabled = true;
  float shadowBias = 0.0005f;
  int shadowMapSize = 2048;  // 512, 1024, 2048, 4096

  // SSAO (Screen Space Ambient Occlusion)
  bool ssaoEnabled = true;
  float ssaoStrength = 0.5f;  // 0.0-1.0
  float ssaoRadius = 0.3f;    // Sample radius

  // Debug visualization
  int debugViewMode = 0;  // 0=normal, 1=raw, 2=depth, 3=normals, etc.

  // Convert sun azimuth/elevation to direction vector
  Vector3 getSunDirection() const {
    float azRad = sunAzimuth * DEG2RAD;
    float elRad = sunElevation * DEG2RAD;
    return Vector3{
      cosf(elRad) * sinf(azRad),
      sinf(elRad),
      cosf(elRad) * cosf(azRad)
    };
  }
};

// PBR Visual properties for materials
struct PBRVisual {
  std::array<float, 3> albedo = {0.8f, 0.8f, 0.8f};  // RGB [0-1]
  float roughness = 0.5f;                             // [0-1]
  float metallic = 0.0f;                              // [0-1]
  std::string albedoTexture;                          // Path to texture (future)
  std::string normalTexture;                          // Path to normal map (future)

  // Convert to raylib Color
  Color toColor() const {
    return Color{
      static_cast<unsigned char>(albedo[0] * 255.0f),
      static_cast<unsigned char>(albedo[1] * 255.0f),
      static_cast<unsigned char>(albedo[2] * 255.0f),
      255
    };
  }
};

// Thermal properties for heat transfer calculations
struct PBRThermal {
  float conductivity = 0.0f;  // Thermal conductivity in W/(m·K)
  float thickness = 0.0f;     // Typical thickness in mm

  // Calculate R-value (thermal resistance) in m²·K/W
  float getRValue() const {
    if (conductivity <= 0.0f || thickness <= 0.0f) return 0.5f;  // Default for unknown
    return (thickness / 1000.0f) / conductivity;  // Convert mm to m
  }

  // Calculate U-value (thermal transmittance) in W/(m²·K)
  float getUValue() const {
    float r = getRValue();
    return r > 0.0f ? 1.0f / r : 2.0f;  // Default U=2 for unknown
  }
};

// Pricing info for BOM generation
struct PBRPricing {
  std::string unit;
  float unitPrice = 0.0f;
  std::string supplier;
  std::string link;
  std::string sku;
  std::string ean;
  std::string lastPriceCheck;
  std::string currency = "EUR";
  struct AltSupplier {
    std::string supplier;
    float unitPrice = 0.0f;
    std::string link;
    std::string sku;
  };
  std::vector<AltSupplier> alternativeSuppliers;
};

// Structural properties for lumber and framing
struct PBRStructural {
  std::string gradeClass;        // e.g., "C24"
  float maxSpan_floor_mm = 0;    // Max span as floor joist
  float maxSpan_wall_mm = 0;     // Max span as wall stud
  float maxSpan_rafter_mm = 0;   // Max span as rafter
  float bendingStrength_MPa = 0; // Characteristic bending strength
  float modulus_GPa = 0;         // Modulus of elasticity
};

// Full PBR material definition
struct PBRMaterial {
  std::string id;
  std::string name;
  std::string category;
  std::vector<std::string> tags;
  PBRVisual visual;
  PBRThermal thermal;
  PBRPricing pricing;
  PBRStructural structural;
};

// Material library loaded from JSON
struct MaterialLibrary {
  std::unordered_map<std::string, PBRMaterial> materials;
  std::unordered_map<std::string, Texture2D> loadedTextures;  // Keyed by material ID
  std::filesystem::path basePath;

  const PBRMaterial* get(const std::string& id) const {
    auto it = materials.find(id);
    return it != materials.end() ? &it->second : nullptr;
  }

  // Get loaded texture for a material (returns nullptr if not loaded)
  Texture2D* getTexture(const std::string& materialId) {
    auto it = loadedTextures.find(materialId);
    return it != loadedTextures.end() ? &it->second : nullptr;
  }

  const Texture2D* getTexture(const std::string& materialId) const {
    auto it = loadedTextures.find(materialId);
    return it != loadedTextures.end() ? &it->second : nullptr;
  }
};

// Scene object with optional color and material reference
struct ColoredObject {
  std::shared_ptr<manifold::Manifold> geometry;
  Color color;
  std::string materialId;  // Optional reference to material library
  std::string objectId;    // Optional unique ID for assembly step filtering
  int quantity = 1;        // For BOM calculation
  bool assemblyOnly = false; // If true, only visible in assembly mode
  float roughness = -1.0f;   // PBR roughness override (-1 = use default/material)
  float metallic = -1.0f;    // PBR metallic override (-1 = use default/material)
};

// Collection of scene objects
struct SceneData {
  std::vector<ColoredObject> objects;
};

// Raylib model with associated color and material reference
struct ModelWithColor {
  Model model;
  Color color;
  std::string materialId;  // For texture lookup
  size_t sceneObjectIndex = 0;  // Index into sceneData.objects (for assemblyOnly check)
  float roughness = -1.0f;   // PBR roughness override (-1 = use default/material)
  float metallic = -1.0f;    // PBR metallic override (-1 = use default/material)
};

// Module loader state for QuickJS
struct ModuleLoaderData {
  std::filesystem::path baseDir;
  std::set<std::filesystem::path> dependencies;
};

// Editable scene parameter (parsed from JS file)
struct SceneParameter {
  std::string name;
  std::string displayName;
  std::string section;
  float value;
  float minValue;
  float maxValue;
  int lineNumber;
};

// Material item for cost estimation
struct MaterialItem {
  std::string name;
  std::string materialId;  // Key to match with model objects
  std::string category;
  std::string link;
  std::string unit;
  float unitPrice = 0.0f;
  int quantity = 0;
  float surfaceArea = 0.0f;  // Total surface area in square meters
  Color color = {200, 200, 200, 255};  // Preview color from material library
};

// File watch state
struct WatchedFile {
  std::optional<std::filesystem::file_time_type> timestamp;
};

// Result of loading a scene from JS
struct LoadResult {
  bool success = false;
  SceneData sceneData;
  std::string message;
  std::vector<std::filesystem::path> dependencies;
  std::vector<MaterialItem> materials;
  AssemblyInstructions assembly;  // Scene-defined assembly (empty if not defined)
  double displayScale = 1.0;
};

// Pre-computed mesh for GPU upload
struct PrecomputedMesh {
  manifold::MeshGL meshGL;
  Color color;
  std::string materialId;
  std::string objectId;  // For assembly step filtering
  size_t sceneObjectIndex = 0;  // Index into sceneData.objects (for assemblyOnly check)
  float roughness = -1.0f;
  float metallic = -1.0f;
};

// Result of background loading (JS eval + CSG + tessellation)
struct BackgroundLoadResult {
  bool success = false;
  std::string message;
  SceneData sceneData;
  std::vector<PrecomputedMesh> meshes;
  std::vector<std::filesystem::path> dependencies;
  std::vector<MaterialItem> materials;
  AssemblyInstructions assembly;  // Scene-defined assembly (empty if not defined)
  double displayScale = 1.0;
};

}  // namespace helscoop

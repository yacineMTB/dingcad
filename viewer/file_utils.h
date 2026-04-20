#pragma once

#include "types.h"
#include "manifold/manifold.h"

#include <filesystem>
#include <optional>
#include <string>
#include <vector>

namespace helscoop {

// Read entire text file into string
std::optional<std::string> ReadTextFile(const std::filesystem::path& path);

// Find default scene.js (current dir or home)
std::optional<std::filesystem::path> FindDefaultScene();

// Write mesh to binary STL file
bool WriteMeshAsBinaryStl(const manifold::MeshGL& mesh,
                          const std::filesystem::path& path,
                          std::string& error);

// Write mesh to Wavefront OBJ file (with normals)
bool WriteMeshAsObj(const manifold::MeshGL& mesh,
                    const std::filesystem::path& path,
                    std::string& error);

// Parse scene parameters from JS file
std::vector<SceneParameter> ParseSceneParameters(const std::filesystem::path& path);

// Write parameter value back to JS file
bool WriteParameterToFile(const std::filesystem::path& path, const SceneParameter& param);

}  // namespace helscoop

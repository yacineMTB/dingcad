#include "file_utils.h"

#include <array>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <regex>
#include <sstream>

namespace helscoop {

std::optional<std::string> ReadTextFile(const std::filesystem::path& path) {
  std::ifstream file(path);
  if (!file) return std::nullopt;
  std::ostringstream ss;
  ss << file.rdbuf();
  return ss.str();
}

std::optional<std::filesystem::path> FindDefaultScene() {
  auto cwdCandidate = std::filesystem::current_path() / "scene.js";
  if (std::filesystem::exists(cwdCandidate)) return cwdCandidate;
  if (const char* home = std::getenv("HOME")) {
    std::filesystem::path homeCandidate = std::filesystem::path(home) / "scene.js";
    if (std::filesystem::exists(homeCandidate)) return homeCandidate;
  }
  return std::nullopt;
}

namespace {

Vec3f FetchVertex(const manifold::MeshGL& mesh, uint32_t index) {
  const size_t offset = static_cast<size_t>(index) * mesh.numProp;
  return {
    static_cast<float>(mesh.vertProperties[offset + 0]),
    static_cast<float>(mesh.vertProperties[offset + 1]),
    static_cast<float>(mesh.vertProperties[offset + 2])
  };
}

Vec3f Subtract(const Vec3f& a, const Vec3f& b) {
  return {a.x - b.x, a.y - b.y, a.z - b.z};
}

Vec3f Cross(const Vec3f& a, const Vec3f& b) {
  return {
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  };
}

Vec3f Normalize(const Vec3f& v) {
  const float lenSq = v.x * v.x + v.y * v.y + v.z * v.z;
  if (lenSq <= 0.0f) return {0.0f, 0.0f, 0.0f};
  const float invLen = 1.0f / std::sqrt(lenSq);
  return {v.x * invLen, v.y * invLen, v.z * invLen};
}

}  // namespace

bool WriteMeshAsBinaryStl(const manifold::MeshGL& mesh,
                          const std::filesystem::path& path,
                          std::string& error) {
  const uint32_t triCount = static_cast<uint32_t>(mesh.NumTri());
  if (triCount == 0) {
    error = "Export failed: mesh is empty";
    return false;
  }

  std::ofstream out(path, std::ios::binary);
  if (!out) {
    error = "Export failed: cannot open " + path.string();
    return false;
  }

  std::array<char, 80> header{};
  constexpr const char kHeader[] = "helscoop export";
  std::memcpy(header.data(), kHeader, std::min(header.size(), std::strlen(kHeader)));
  out.write(header.data(), header.size());
  out.write(reinterpret_cast<const char*>(&triCount), sizeof(uint32_t));

  for (uint32_t tri = 0; tri < triCount; ++tri) {
    const uint32_t i0 = mesh.triVerts[tri * 3 + 0];
    const uint32_t i1 = mesh.triVerts[tri * 3 + 1];
    const uint32_t i2 = mesh.triVerts[tri * 3 + 2];

    const Vec3f v0 = FetchVertex(mesh, i0);
    const Vec3f v1 = FetchVertex(mesh, i1);
    const Vec3f v2 = FetchVertex(mesh, i2);

    const Vec3f normal = Normalize(Cross(Subtract(v1, v0), Subtract(v2, v0)));

    out.write(reinterpret_cast<const char*>(&normal), sizeof(Vec3f));
    out.write(reinterpret_cast<const char*>(&v0), sizeof(Vec3f));
    out.write(reinterpret_cast<const char*>(&v1), sizeof(Vec3f));
    out.write(reinterpret_cast<const char*>(&v2), sizeof(Vec3f));
    const uint16_t attr = 0;
    out.write(reinterpret_cast<const char*>(&attr), sizeof(uint16_t));
  }

  if (!out) {
    error = "Export failed: write error";
    return false;
  }

  return true;
}

bool WriteMeshAsObj(const manifold::MeshGL& mesh,
                    const std::filesystem::path& path,
                    std::string& error) {
  const uint32_t triCount = static_cast<uint32_t>(mesh.NumTri());
  if (triCount == 0) {
    error = "Export failed: mesh is empty";
    return false;
  }

  std::ofstream out(path);
  if (!out) {
    error = "Export failed: cannot open " + path.string();
    return false;
  }

  out << "# helscoop OBJ export\n";
  out << "# Vertices: " << mesh.NumVert() << " Triangles: " << triCount << "\n\n";

  const uint32_t numVerts = static_cast<uint32_t>(mesh.NumVert());
  for (uint32_t i = 0; i < numVerts; ++i) {
    const Vec3f v = FetchVertex(mesh, i);
    out << "v " << v.x << " " << v.y << " " << v.z << "\n";
  }
  out << "\n";

  // Compute per-face normals and accumulate into per-vertex normals for smooth shading
  std::vector<Vec3f> vertNormals(numVerts, {0.0f, 0.0f, 0.0f});
  for (uint32_t tri = 0; tri < triCount; ++tri) {
    const uint32_t i0 = mesh.triVerts[tri * 3 + 0];
    const uint32_t i1 = mesh.triVerts[tri * 3 + 1];
    const uint32_t i2 = mesh.triVerts[tri * 3 + 2];
    const Vec3f v0 = FetchVertex(mesh, i0);
    const Vec3f v1 = FetchVertex(mesh, i1);
    const Vec3f v2 = FetchVertex(mesh, i2);
    const Vec3f fn = Cross(Subtract(v1, v0), Subtract(v2, v0));
    vertNormals[i0] = {vertNormals[i0].x + fn.x, vertNormals[i0].y + fn.y, vertNormals[i0].z + fn.z};
    vertNormals[i1] = {vertNormals[i1].x + fn.x, vertNormals[i1].y + fn.y, vertNormals[i1].z + fn.z};
    vertNormals[i2] = {vertNormals[i2].x + fn.x, vertNormals[i2].y + fn.y, vertNormals[i2].z + fn.z};
  }
  for (uint32_t i = 0; i < numVerts; ++i) {
    vertNormals[i] = Normalize(vertNormals[i]);
    out << "vn " << vertNormals[i].x << " " << vertNormals[i].y << " " << vertNormals[i].z << "\n";
  }
  out << "\n";

  for (uint32_t tri = 0; tri < triCount; ++tri) {
    const uint32_t i0 = mesh.triVerts[tri * 3 + 0] + 1;
    const uint32_t i1 = mesh.triVerts[tri * 3 + 1] + 1;
    const uint32_t i2 = mesh.triVerts[tri * 3 + 2] + 1;
    out << "f " << i0 << "//" << i0 << " " << i1 << "//" << i1 << " " << i2 << "//" << i2 << "\n";
  }

  if (!out) {
    error = "Export failed: write error";
    return false;
  }

  return true;
}

std::vector<SceneParameter> ParseSceneParameters(const std::filesystem::path& path) {
  std::vector<SceneParameter> params;

  auto source = ReadTextFile(path);
  if (!source) return params;

  // Check for re-export pattern: export { ... } from './path/to/file.js'
  // Or import pattern: import { ... } from './path/to/file.js'
  // If found, parse that file instead (it contains the actual parameter definitions)
  std::regex reexportRegex(R"((export|import)\s*\{[^}]*\}\s*from\s*['\"]([^'\"]+)['\"])");
  std::smatch match;
  if (std::regex_search(*source, match, reexportRegex)) {
    std::string importPath = match[2].str();  // Changed from match[1] to match[2] due to extra group
    std::filesystem::path resolvedPath = path.parent_path() / importPath;
    if (std::filesystem::exists(resolvedPath)) {
      source = ReadTextFile(resolvedPath);
      if (!source) return params;
    }
  }

  // Parse @param annotations: // @param name "Section" Description (min-max)
  struct PendingParam {
    std::string name;
    std::string displayName;
    std::string section;
    float minVal = 0;
    float maxVal = 100;
  };

  std::regex paramAnnotation(
    R"re(//\s*@param\s+(\w+)\s+"([^"]+)"\s+(.*))re");

  std::istringstream stream(*source);
  std::string line;
  int lineNum = 0;
  std::optional<PendingParam> pending;

  while (std::getline(stream, line)) {
    lineNum++;

    // Check for @param annotation
    std::smatch paramMatch;
    if (std::regex_search(line, paramMatch, paramAnnotation)) {
      PendingParam p;
      p.name = paramMatch[1].str();
      p.section = paramMatch[2].str();
      std::string rest = paramMatch[3].str();

      // Extract (min-max) range from end of description
      std::regex rangeRegex(R"(\((\-?[\d.]+)\s*-\s*(\-?[\d.]+)\)\s*$)");
      std::smatch rangeMatch;
      if (std::regex_search(rest, rangeMatch, rangeRegex)) {
        p.minVal = std::stof(rangeMatch[1].str());
        p.maxVal = std::stof(rangeMatch[2].str());
        rest = rest.substr(0, rangeMatch.position());
      }

      // Clean up display name from remaining description
      rest.erase(rest.find_last_not_of(" \t") + 1);
      if (rest.empty()) {
        // Convert snake_case name to Title Case
        p.displayName = p.name;
        for (auto& ch : p.displayName) {
          if (ch == '_') ch = ' ';
        }
        if (!p.displayName.empty()) {
          p.displayName[0] = std::toupper(p.displayName[0]);
        }
      } else {
        p.displayName = rest;
      }

      pending = p;
      continue;
    }

    // Check if this line has a const declaration matching a pending @param
    if (pending) {
      std::string pattern = "const " + pending->name + " = ";
      size_t pos = line.find(pattern);
      if (pos != std::string::npos) {
        size_t valueStart = pos + pattern.length();
        size_t valueEnd = line.find(';', valueStart);
        if (valueEnd != std::string::npos) {
          std::string valueStr = line.substr(valueStart, valueEnd - valueStart);
          valueStr.erase(0, valueStr.find_first_not_of(" \t"));
          valueStr.erase(valueStr.find_last_not_of(" \t") + 1);
          try {
            float value = std::stof(valueStr);
            params.push_back({
              pending->name, pending->displayName, pending->section,
              value, pending->minVal, pending->maxVal, lineNum
            });
          } catch (...) {}
        }
      }
      pending.reset();
    }
  }

  return params;
}

bool WriteParameterToFile(const std::filesystem::path& path, const SceneParameter& param) {
  // First check if this file re-exports from another file
  auto source = ReadTextFile(path);
  if (!source) {
    std::cerr << "WriteParameterToFile: Failed to read " << path << std::endl;
    return false;
  }

  std::filesystem::path actualPath = path;

  // Check for re-export or import pattern
  std::regex reexportRegex(R"((export|import)\s*\{[^}]*\}\s*from\s*['\"]([^'\"]+)['\"])");
  std::smatch match;
  if (std::regex_search(*source, match, reexportRegex)) {
    std::string importPath = match[2].str();
    std::filesystem::path resolvedPath = path.parent_path() / importPath;
    std::cerr << "WriteParameterToFile: Found import, resolved to " << resolvedPath << std::endl;
    if (std::filesystem::exists(resolvedPath)) {
      actualPath = resolvedPath;
      source = ReadTextFile(actualPath);
      if (!source) {
        std::cerr << "WriteParameterToFile: Failed to read resolved file" << std::endl;
        return false;
      }
    } else {
      std::cerr << "WriteParameterToFile: Resolved file does not exist" << std::endl;
    }
  } else {
    std::cerr << "WriteParameterToFile: No import pattern found in " << path << std::endl;
  }

  std::ostringstream result;
  std::istringstream stream(*source);
  std::string line;
  int lineNum = 0;

  while (std::getline(stream, line)) {
    lineNum++;
    if (lineNum == param.lineNumber) {
      std::string pattern = std::string("const ") + param.name + " = ";
      size_t pos = line.find(pattern);
      if (pos != std::string::npos) {
        size_t valueStart = pos + pattern.length();
        size_t valueEnd = line.find(';', valueStart);
        if (valueEnd != std::string::npos) {
          std::ostringstream newValue;
          float intpart;
          if (std::modff(param.value, &intpart) == 0.0f) {
            newValue << static_cast<int>(param.value);
          } else {
            newValue << param.value;
          }
          result << line.substr(0, valueStart) << newValue.str() << line.substr(valueEnd) << "\n";
          continue;
        }
      }
    }
    result << line << "\n";
  }

  std::cerr << "WriteParameterToFile: Writing param '" << param.name << "' = " << param.value
            << " at line " << param.lineNumber << " to " << actualPath << std::endl;

  auto tmpPath = actualPath;
  tmpPath += ".tmp";
  {
    std::ofstream out(tmpPath);
    if (!out) {
      std::cerr << "WriteParameterToFile: Failed to open temp file for writing" << std::endl;
      return false;
    }
    out << result.str();
    out.flush();
    if (!out.good()) {
      std::cerr << "WriteParameterToFile: Write failed" << std::endl;
      std::filesystem::remove(tmpPath);
      return false;
    }
  }
  std::error_code ec;
  std::filesystem::rename(tmpPath, actualPath, ec);
  if (ec) {
    std::cerr << "WriteParameterToFile: Rename failed: " << ec.message() << std::endl;
    std::filesystem::remove(tmpPath);
    return false;
  }
  std::cerr << "WriteParameterToFile: Success" << std::endl;
  return true;
}

}  // namespace helscoop

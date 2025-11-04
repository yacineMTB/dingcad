#include "raylib.h"
#include "raymath.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cmath>
#include <cstring>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <set>
#include <sstream>
#include <string>
#include <system_error>
#include <unordered_map>
#include <vector>

extern "C" {
#include "quickjs.h"
}

#include "manifold/manifold.h"
#include "manifold/polygon.h"
#include "js_bindings.h"

namespace {
const Color kBaseColor = {210, 210, 220, 255};
const Color kWireColor = Fade(BLACK, 0.25f);
const char *kBrandText = "dingcad";
constexpr float kBrandFontSize = 28.0f;
constexpr float kSceneScale = 0.1f;  // convert mm scene units to renderer units

struct Vec3f {
  float x;
  float y;
  float z;
};

struct ModuleLoaderData {
  std::filesystem::path baseDir;
  std::set<std::filesystem::path> dependencies;
};

ModuleLoaderData g_module_loader_data;

struct WatchedFile {
  std::optional<std::filesystem::file_time_type> timestamp;
};

Vec3f FetchVertex(const manifold::MeshGL &mesh, uint32_t index) {
  const size_t offset = static_cast<size_t>(index) * mesh.numProp;
  return {
      static_cast<float>(mesh.vertProperties[offset + 0]),
      static_cast<float>(mesh.vertProperties[offset + 1]),
      static_cast<float>(mesh.vertProperties[offset + 2])
  };
}

Vec3f Subtract(const Vec3f &a, const Vec3f &b) {
  return {a.x - b.x, a.y - b.y, a.z - b.z};
}

Vec3f Cross(const Vec3f &a, const Vec3f &b) {
  return {a.y * b.z - a.z * b.y,
          a.z * b.x - a.x * b.z,
          a.x * b.y - a.y * b.x};
}

Vec3f Normalize(const Vec3f &v) {
  const float lenSq = v.x * v.x + v.y * v.y + v.z * v.z;
  if (lenSq <= 0.0f) return {0.0f, 0.0f, 0.0f};
  const float invLen = 1.0f / std::sqrt(lenSq);
  return {v.x * invLen, v.y * invLen, v.z * invLen};
}

bool WriteMeshAsBinaryStl(const manifold::MeshGL &mesh,
                          const std::filesystem::path &path,
                          std::string &error) {
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
  constexpr const char kHeader[] = "dingcad export";
  std::memcpy(header.data(), kHeader, std::min(header.size(), std::strlen(kHeader)));
  out.write(header.data(), header.size());
  out.write(reinterpret_cast<const char *>(&triCount), sizeof(uint32_t));

  for (uint32_t tri = 0; tri < triCount; ++tri) {
    const uint32_t i0 = mesh.triVerts[tri * 3 + 0];
    const uint32_t i1 = mesh.triVerts[tri * 3 + 1];
    const uint32_t i2 = mesh.triVerts[tri * 3 + 2];

    const Vec3f v0 = FetchVertex(mesh, i0);
    const Vec3f v1 = FetchVertex(mesh, i1);
    const Vec3f v2 = FetchVertex(mesh, i2);

    const Vec3f normal = Normalize(Cross(Subtract(v1, v0), Subtract(v2, v0)));

    out.write(reinterpret_cast<const char *>(&normal), sizeof(Vec3f));
    out.write(reinterpret_cast<const char *>(&v0), sizeof(Vec3f));
    out.write(reinterpret_cast<const char *>(&v1), sizeof(Vec3f));
    out.write(reinterpret_cast<const char *>(&v2), sizeof(Vec3f));
    const uint16_t attr = 0;
    out.write(reinterpret_cast<const char *>(&attr), sizeof(uint16_t));
  }

  if (!out) {
    error = "Export failed: write error";
    return false;
  }

  return true;
}

void DestroyModel(Model &model) {
  if (model.meshes != nullptr || model.materials != nullptr) {
    UnloadModel(model);
  }
  model = Model{};
}

Model CreateRaylibModelFrom(const manifold::MeshGL &meshGL) {
  Model model = {0};
  const int vertexCount = meshGL.NumVert();
  const int triangleCount = meshGL.NumTri();

  if (vertexCount <= 0 || triangleCount <= 0) {
    return model;
  }

  const int stride = meshGL.numProp;
  std::vector<Vector3> positions(vertexCount);
  for (int v = 0; v < vertexCount; ++v) {
    const int base = v * stride;
    // Convert from the scene's Z-up coordinates to raylib's Y-up system.
    const float cadX = meshGL.vertProperties[base + 0] * kSceneScale;
    const float cadY = meshGL.vertProperties[base + 1] * kSceneScale;
    const float cadZ = meshGL.vertProperties[base + 2] * kSceneScale;
    positions[v] = {cadX, cadZ, -cadY};
  }

  std::vector<Vector3> accum(vertexCount, {0.0f, 0.0f, 0.0f});
  for (int tri = 0; tri < triangleCount; ++tri) {
    const int i0 = meshGL.triVerts[tri * 3 + 0];
    const int i1 = meshGL.triVerts[tri * 3 + 1];
    const int i2 = meshGL.triVerts[tri * 3 + 2];

    const Vector3 p0 = positions[i0];
    const Vector3 p1 = positions[i1];
    const Vector3 p2 = positions[i2];

    const Vector3 u = {p1.x - p0.x, p1.y - p0.y, p1.z - p0.z};
    const Vector3 v = {p2.x - p0.x, p2.y - p0.y, p2.z - p0.z};
    const Vector3 n = {u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z,
                       u.x * v.y - u.y * v.x};

    accum[i0].x += n.x;
    accum[i0].y += n.y;
    accum[i0].z += n.z;
    accum[i1].x += n.x;
    accum[i1].y += n.y;
    accum[i1].z += n.z;
    accum[i2].x += n.x;
    accum[i2].y += n.y;
    accum[i2].z += n.z;
  }

  std::vector<Vector3> normals(vertexCount);
  std::vector<Color> colors(vertexCount);
  const Vector3 lightDir = Vector3Normalize({0.45f, 0.85f, 0.35f});
  for (int v = 0; v < vertexCount; ++v) {
    const Vector3 n = accum[v];
    const float length = std::sqrt(n.x * n.x + n.y * n.y + n.z * n.z);

    Vector3 normal = {0.0f, 1.0f, 0.0f};
    if (length > 0.0f) {
      normal = {n.x / length, n.y / length, n.z / length};
    }
    normals[v] = normal;

    float intensity = Vector3DotProduct(normal, lightDir);
    intensity = Clamp(intensity, 0.0f, 1.0f);
    constexpr int toonSteps = 3;
    int level = static_cast<int>(std::floor(intensity * toonSteps));
    if (level >= toonSteps) level = toonSteps - 1;
    const float toon = (toonSteps > 1)
                           ? static_cast<float>(level) /
                                 static_cast<float>(toonSteps - 1)
                           : intensity;
    const float ambient = 0.3f;
    const float diffuse = 0.7f;
    float finalIntensity = Clamp(ambient + diffuse * toon, 0.0f, 1.0f);

    const Color base = kBaseColor;
    Color color = {0};
    color.r = static_cast<unsigned char>(
        Clamp(base.r * finalIntensity, 0.0f, 255.0f));
    color.g = static_cast<unsigned char>(
        Clamp(base.g * finalIntensity, 0.0f, 255.0f));
    color.b = static_cast<unsigned char>(
        Clamp(base.b * finalIntensity, 0.0f, 255.0f));
    color.a = base.a;
    colors[v] = color;
  }

  constexpr int kMaxVerticesPerMesh = std::numeric_limits<unsigned short>::max();
  std::vector<int> remap(vertexCount, 0);
  std::vector<int> remapMarker(vertexCount, 0);
  int chunkToken = 1;

  std::vector<Mesh> meshes;
  meshes.reserve(
      static_cast<size_t>(triangleCount) / kMaxVerticesPerMesh + 1);

  int triIndex = 0;
  while (triIndex < triangleCount) {
    const int currentToken = chunkToken++;
    int chunkVertexCount = 0;
    std::vector<Vector3> chunkPositions;
    std::vector<Vector3> chunkNormals;
    std::vector<Color> chunkColors;
    std::vector<unsigned short> chunkIndices;

    chunkPositions.reserve(std::min(kMaxVerticesPerMesh, vertexCount));
    chunkNormals.reserve(std::min(kMaxVerticesPerMesh, vertexCount));
    chunkColors.reserve(std::min(kMaxVerticesPerMesh, vertexCount));
    chunkIndices.reserve(std::min(kMaxVerticesPerMesh, vertexCount) * 3);

    while (triIndex < triangleCount) {
      const int indices[3] = {
          static_cast<int>(meshGL.triVerts[triIndex * 3 + 0]),
          static_cast<int>(meshGL.triVerts[triIndex * 3 + 1]),
          static_cast<int>(meshGL.triVerts[triIndex * 3 + 2])};

      int needed = 0;
      for (int j = 0; j < 3; ++j) {
        if (remapMarker[indices[j]] != currentToken) {
          ++needed;
        }
      }

      if (chunkVertexCount + needed > kMaxVerticesPerMesh) {
        break;
      }

      for (int j = 0; j < 3; ++j) {
        const int original = indices[j];
        if (remapMarker[original] != currentToken) {
          remapMarker[original] = currentToken;
          remap[original] = chunkVertexCount++;
          chunkPositions.push_back(positions[original]);
          chunkNormals.push_back(normals[original]);
          chunkColors.push_back(colors[original]);
        }
        chunkIndices.push_back(static_cast<unsigned short>(remap[original]));
      }
      ++triIndex;
    }

    Mesh chunkMesh = {0};
    chunkMesh.vertexCount = chunkVertexCount;
    chunkMesh.triangleCount = static_cast<int>(chunkIndices.size() / 3);
    chunkMesh.vertices = static_cast<float *>(
        MemAlloc(chunkVertexCount * 3 * sizeof(float)));
    chunkMesh.normals = static_cast<float *>(
        MemAlloc(chunkVertexCount * 3 * sizeof(float)));
    chunkMesh.colors = static_cast<unsigned char *>(
        MemAlloc(chunkVertexCount * 4 * sizeof(unsigned char)));
    chunkMesh.indices = static_cast<unsigned short *>(
        MemAlloc(chunkIndices.size() * sizeof(unsigned short)));
    chunkMesh.texcoords = nullptr;
    chunkMesh.texcoords2 = nullptr;
    chunkMesh.tangents = nullptr;

    for (int v = 0; v < chunkVertexCount; ++v) {
      const Vector3 &pos = chunkPositions[v];
      chunkMesh.vertices[v * 3 + 0] = pos.x;
      chunkMesh.vertices[v * 3 + 1] = pos.y;
      chunkMesh.vertices[v * 3 + 2] = pos.z;

      const Vector3 &normal = chunkNormals[v];
      chunkMesh.normals[v * 3 + 0] = normal.x;
      chunkMesh.normals[v * 3 + 1] = normal.y;
      chunkMesh.normals[v * 3 + 2] = normal.z;

      const Color color = chunkColors[v];
      chunkMesh.colors[v * 4 + 0] = color.r;
      chunkMesh.colors[v * 4 + 1] = color.g;
      chunkMesh.colors[v * 4 + 2] = color.b;
      chunkMesh.colors[v * 4 + 3] = color.a;
    }

    std::memcpy(chunkMesh.indices, chunkIndices.data(),
                chunkIndices.size() * sizeof(unsigned short));
    UploadMesh(&chunkMesh, false);
    meshes.push_back(chunkMesh);
  }

  if (meshes.empty()) {
    return model;
  }

  model.transform = MatrixIdentity();
  model.meshCount = static_cast<int>(meshes.size());
  model.meshes = static_cast<Mesh *>(
      MemAlloc(model.meshCount * sizeof(Mesh)));
  for (int i = 0; i < model.meshCount; ++i) {
    model.meshes[i] = meshes[i];
  }
  model.materialCount = 1;
  model.materials = static_cast<Material *>(MemAlloc(sizeof(Material)));
  model.materials[0] = LoadMaterialDefault();
  model.meshMaterial = static_cast<int *>(
      MemAlloc(model.meshCount * sizeof(int)));
  for (int i = 0; i < model.meshCount; ++i) {
    model.meshMaterial[i] = 0;
  }

  return model;
}

void DrawAxes(float length) {
  const float shaftRadius = std::max(length * 0.02f, 0.01f);
  const float headLength = std::min(length * 0.2f, length * 0.75f);
  const float headRadius = shaftRadius * 2.5f;

  auto drawAxis = [&](Vector3 direction, Color color) {
    const Vector3 origin = {0.0f, 0.0f, 0.0f};
    const float shaftLength = std::max(length - headLength, 0.0f);
    const Vector3 shaftEnd = Vector3Scale(direction, shaftLength);
    const Vector3 axisEnd = Vector3Scale(direction, length);

    if (shaftLength > 0.0f) {
      DrawCylinderEx(origin, shaftEnd, shaftRadius, shaftRadius, 12, Fade(color, 0.65f));
    }
    DrawCylinderEx(shaftEnd, axisEnd, headRadius, 0.0f, 16, color);
  };

  drawAxis({1.0f, 0.0f, 0.0f}, RED);    // +X
  drawAxis({0.0f, 1.0f, 0.0f}, GREEN);  // +Y
  drawAxis({0.0f, 0.0f, 1.0f}, BLUE);   // +Z

  DrawSphereEx({0.0f, 0.0f, 0.0f}, shaftRadius * 1.2f, 12, 12, LIGHTGRAY);
}

void DrawXZGrid(int halfLines, float spacing, Color color) {
  for (int i = -halfLines; i <= halfLines; ++i) {
    const float offset = static_cast<float>(i) * spacing;
    DrawLine3D({offset, 0.0f, -halfLines * spacing},
               {offset, 0.0f, halfLines * spacing}, color);
    DrawLine3D({-halfLines * spacing, 0.0f, offset},
               {halfLines * spacing, 0.0f, offset}, color);
  }
}

std::optional<std::filesystem::path> FindDefaultScene() {
  auto cwdCandidate = std::filesystem::current_path() / "scene.js";
  if (std::filesystem::exists(cwdCandidate)) return cwdCandidate;
  if (const char *home = std::getenv("HOME")) {
    std::filesystem::path homeCandidate = std::filesystem::path(home) / "scene.js";
    if (std::filesystem::exists(homeCandidate)) return homeCandidate;
  }
  return std::nullopt;
}

std::optional<std::string> ReadTextFile(const std::filesystem::path &path) {
  std::ifstream file(path);
  if (!file) return std::nullopt;
  std::ostringstream ss;
  ss << file.rdbuf();
  return ss.str();
}

JSModuleDef *FilesystemModuleLoader(JSContext *ctx, const char *module_name, void *opaque) {
  auto *data = static_cast<ModuleLoaderData *>(opaque);
  std::filesystem::path resolved(module_name);
  if (resolved.is_relative()) {
    const std::filesystem::path base = data && !data->baseDir.empty()
                                           ? data->baseDir
                                           : std::filesystem::current_path();
    resolved = base / resolved;
  }
  resolved = std::filesystem::absolute(resolved).lexically_normal();

  if (data) {
    data->baseDir = resolved.parent_path();
    data->dependencies.insert(resolved);
  }

  auto source = ReadTextFile(resolved);
  if (!source) {
    JS_ThrowReferenceError(ctx, "Unable to load module '%s'", resolved.string().c_str());
    return nullptr;
  }

  const std::string moduleName = resolved.string();
  JSValue funcVal = JS_Eval(ctx, source->c_str(), source->size(), moduleName.c_str(),
                            JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(funcVal)) {
    return nullptr;
  }

  auto *module = static_cast<JSModuleDef *>(JS_VALUE_GET_PTR(funcVal));
  JS_FreeValue(ctx, funcVal);
  return module;
}

struct LoadResult {
  bool success = false;
  std::shared_ptr<manifold::Manifold> manifold;
  std::string message;
  std::vector<std::filesystem::path> dependencies;
};

LoadResult LoadSceneFromFile(JSRuntime *runtime, const std::filesystem::path &path) {
  LoadResult result;
  const auto absolutePath = std::filesystem::absolute(path);
  if (!std::filesystem::exists(absolutePath)) {
    result.message = "Scene file not found: " + absolutePath.string();
    return result;
  }
  g_module_loader_data.baseDir = absolutePath.parent_path();
  g_module_loader_data.dependencies.clear();
  g_module_loader_data.dependencies.insert(absolutePath);
  auto sourceOpt = ReadTextFile(absolutePath);
  if (!sourceOpt) {
    result.message = "Unable to read scene file: " + absolutePath.string();
    result.dependencies.assign(g_module_loader_data.dependencies.begin(),
                               g_module_loader_data.dependencies.end());
    return result;
  }
  JSContext *ctx = JS_NewContext(runtime);
  RegisterBindings(ctx);

  auto captureException = [&]() {
    JSValue exc = JS_GetException(ctx);
    JSValue stack = JS_GetPropertyStr(ctx, exc, "stack");
    const char *stackStr = JS_ToCString(ctx, JS_IsUndefined(stack) ? exc : stack);
    result.message = stackStr ? stackStr : "JavaScript error";
    JS_FreeCString(ctx, stackStr);
    JS_FreeValue(ctx, stack);
    JS_FreeValue(ctx, exc);
  };
  auto assignDependencies = [&]() {
    result.dependencies.assign(g_module_loader_data.dependencies.begin(),
                               g_module_loader_data.dependencies.end());
  };

  JSValue moduleFunc = JS_Eval(ctx, sourceOpt->c_str(), sourceOpt->size(), absolutePath.string().c_str(),
                               JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(moduleFunc)) {
    captureException();
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }

  if (JS_ResolveModule(ctx, moduleFunc) < 0) {
    captureException();
    JS_FreeValue(ctx, moduleFunc);
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }

  auto *module = static_cast<JSModuleDef *>(JS_VALUE_GET_PTR(moduleFunc));
  JSValue evalResult = JS_EvalFunction(ctx, moduleFunc);
  if (JS_IsException(evalResult)) {
    captureException();
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }
  JS_FreeValue(ctx, evalResult);

  JSValue moduleNamespace = JS_GetModuleNamespace(ctx, module);
  if (JS_IsException(moduleNamespace)) {
    captureException();
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }

  JSValue sceneVal = JS_GetPropertyStr(ctx, moduleNamespace, "scene");
  if (JS_IsException(sceneVal)) {
    JS_FreeValue(ctx, moduleNamespace);
    captureException();
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }
  JS_FreeValue(ctx, moduleNamespace);

  if (JS_IsUndefined(sceneVal)) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeContext(ctx);
    result.message = "Scene module must export 'scene'";
    assignDependencies();
    return result;
  }

  auto sceneHandle = GetManifoldHandle(ctx, sceneVal);
  if (!sceneHandle) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeContext(ctx);
    result.message = "Exported 'scene' is not a manifold";
    assignDependencies();
    return result;
  }

  result.manifold = sceneHandle;
  result.success = true;
  result.message = "Loaded " + absolutePath.string();
  assignDependencies();
  JS_FreeValue(ctx, sceneVal);
  JS_FreeContext(ctx);
  return result;
}

bool ReplaceScene(Model &model,
                  const std::shared_ptr<manifold::Manifold> &scene) {
  if (!scene) return false;
  Model newModel = CreateRaylibModelFrom(scene->GetMeshGL());
  DestroyModel(model);
  model = newModel;
  return true;
}

}  // namespace

int main() {
  SetConfigFlags(FLAG_MSAA_4X_HINT | FLAG_WINDOW_RESIZABLE);
  InitWindow(1280, 720, "dingcad");
  SetTargetFPS(60);

  Font brandingFont = GetFontDefault();
  bool brandingFontCustom = false;
  const std::filesystem::path consolasPath("/System/Library/Fonts/Supplemental/Consolas.ttf");
  if (std::filesystem::exists(consolasPath)) {
    brandingFont = LoadFontEx(consolasPath.string().c_str(), static_cast<int>(kBrandFontSize), nullptr, 0);
    brandingFontCustom = true;
  }

  Camera3D camera = {0};
  camera.position = {4.0f, 4.0f, 4.0f};
  camera.target = {0.0f, 0.5f, 0.0f};
  camera.up = {0.0f, 1.0f, 0.0f};
  camera.fovy = 45.0f;
  camera.projection = CAMERA_PERSPECTIVE;

  float orbitDistance = Vector3Distance(camera.position, camera.target);
  float orbitYaw = atan2f(camera.position.x - camera.target.x,
                          camera.position.z - camera.target.z);
  float orbitPitch = asinf((camera.position.y - camera.target.y) / orbitDistance);
  const Vector3 initialTarget = camera.target;
  const float initialDistance = orbitDistance;
  const float initialYaw = orbitYaw;
  const float initialPitch = orbitPitch;

  JSRuntime *runtime = JS_NewRuntime();
  EnsureManifoldClass(runtime);
  JS_SetModuleLoaderFunc(runtime, nullptr, FilesystemModuleLoader, &g_module_loader_data);

  std::shared_ptr<manifold::Manifold> scene = nullptr;
  std::string statusMessage;
  std::filesystem::path scriptPath;
  std::unordered_map<std::filesystem::path, WatchedFile> watchedFiles;
  auto defaultScript = FindDefaultScene();
  auto reportStatus = [&](const std::string &message) {
    statusMessage = message;
    TraceLog(LOG_INFO, "%s", statusMessage.c_str());
    std::cout << statusMessage << std::endl;
  };
  auto setWatchedFiles = [&](const std::vector<std::filesystem::path> &deps) {
    std::unordered_map<std::filesystem::path, WatchedFile> updated;
    for (const auto &dep : deps) {
      WatchedFile entry;
      std::error_code ec;
      auto ts = std::filesystem::last_write_time(dep, ec);
      if (!ec) {
        entry.timestamp = ts;
      }
      updated.emplace(dep, entry);
    }
    watchedFiles = std::move(updated);
  };
  if (defaultScript) {
    scriptPath = std::filesystem::absolute(*defaultScript);
    auto load = LoadSceneFromFile(runtime, scriptPath);
    if (load.success) {
      scene = load.manifold;
      reportStatus(load.message);
    } else {
      reportStatus(load.message);
    }
    if (!load.dependencies.empty()) {
      setWatchedFiles(load.dependencies);
    }
  }
  if (!scene) {
    manifold::Manifold cube = manifold::Manifold::Cube({2.0, 2.0, 2.0}, true);
    manifold::Manifold sphere = manifold::Manifold::Sphere(1.2, 0);
    manifold::Manifold combo = cube + sphere.Translate({0.0, 0.8, 0.0});
    scene = std::make_shared<manifold::Manifold>(combo);
    if (statusMessage.empty()) {
      reportStatus("No scene.js found. Using built-in sample.");
    }
  }

  Model model = CreateRaylibModelFrom(scene->GetMeshGL());

  while (!WindowShouldClose()) {
    const Vector2 mouseDelta = GetMouseDelta();

    auto reloadScene = [&]() {
      auto load = LoadSceneFromFile(runtime, scriptPath);
      if (load.success) {
        scene = load.manifold;
        ReplaceScene(model, scene);
        reportStatus(load.message);
      } else {
        reportStatus(load.message);
      }
      if (!load.dependencies.empty()) {
        setWatchedFiles(load.dependencies);
      }
    };

    if (!scriptPath.empty()) {
      bool changed = false;
      for (const auto &entry : watchedFiles) {
        std::error_code ec;
        auto currentTs = std::filesystem::last_write_time(entry.first, ec);
        if (ec) {
          if (entry.second.timestamp.has_value()) {
            changed = true;
            break;
          }
        } else if (!entry.second.timestamp.has_value() ||
                   currentTs != *entry.second.timestamp) {
          changed = true;
          break;
        }
      }
      if (changed) {
        reloadScene();
      }
    }

    if (IsKeyPressed(KEY_R) && !scriptPath.empty()) {
      reloadScene();
    }

    static bool prevPDown = false;
    bool exportRequested = false;

    for (int key = GetKeyPressed(); key != 0; key = GetKeyPressed()) {
      TraceLog(LOG_INFO, "Key pressed: %d", key);
      std::cout << "Key pressed: " << key << std::endl;
      if (key == KEY_P) {
        exportRequested = true;
      }
    }

    for (int ch = GetCharPressed(); ch != 0; ch = GetCharPressed()) {
      TraceLog(LOG_INFO, "Char pressed: %d", ch);
      std::cout << "Char pressed: " << ch << std::endl;
      if (ch == 'p' || ch == 'P') {
        exportRequested = true;
      }
    }

    const bool pDown = IsKeyDown(KEY_P);
    if (pDown && !prevPDown) {
      TraceLog(LOG_INFO, "P key down edge detected");
      std::cout << "P key down edge detected" << std::endl;
      exportRequested = true;
    }
    prevPDown = pDown;

    if (!exportRequested && IsKeyPressed(KEY_P)) {
      exportRequested = true;
    }

    if (exportRequested) {
      TraceLog(LOG_INFO, "Export trigger detected");
      std::cout << "Export trigger detected" << std::endl;
      if (scene) {
        std::filesystem::path downloads;
        if (const char *home = std::getenv("HOME")) {
          downloads = std::filesystem::path(home) / "Downloads";
        } else {
          downloads = std::filesystem::current_path();
        }

        std::error_code dirErr;
        std::filesystem::create_directories(downloads, dirErr);
        if (dirErr && !std::filesystem::exists(downloads)) {
          reportStatus("Export failed: cannot access " + downloads.string());
        } else {
          std::filesystem::path savePath = downloads / "ding.stl";
          std::string error;
          const bool ok = WriteMeshAsBinaryStl(scene->GetMeshGL(), savePath, error);
          TraceLog(LOG_INFO, "Export path: %s", savePath.string().c_str());
          if (ok) {
            reportStatus("Saved " + savePath.string());
          } else {
            reportStatus(error);
          }
        }
      } else {
        reportStatus("No scene loaded to export");
      }
    }

    if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
      orbitYaw -= mouseDelta.x * 0.01f;
      orbitPitch += mouseDelta.y * 0.01f;
      const float limit = DEG2RAD * 89.0f;
      orbitPitch = Clamp(orbitPitch, -limit, limit);
    }

    const float wheel = GetMouseWheelMove();
    if (wheel != 0.0f) {
      orbitDistance *= (1.0f - wheel * 0.1f);
      orbitDistance = Clamp(orbitDistance, 1.0f, 50.0f);
    }

    const Vector3 forward = Vector3Normalize(Vector3Subtract(camera.target, camera.position));
    const Vector3 worldUp = {0.0f, 1.0f, 0.0f};
    const Vector3 right = Vector3Normalize(Vector3CrossProduct(worldUp, forward));
    const Vector3 camUp = Vector3CrossProduct(forward, right);

    if (IsMouseButtonDown(MOUSE_BUTTON_RIGHT)) {
      camera.target = Vector3Add(camera.target,
                                 Vector3Scale(right, mouseDelta.x * 0.01f * orbitDistance));
      camera.target = Vector3Add(camera.target,
                                 Vector3Scale(camUp, -mouseDelta.y * 0.01f * orbitDistance));
    }

    if (IsKeyPressed(KEY_SPACE)) {
      camera.target = initialTarget;
      orbitDistance = initialDistance;
      orbitYaw = initialYaw;
      orbitPitch = initialPitch;
    }

    const float moveSpeed = 0.05f * orbitDistance;
    if (IsKeyDown(KEY_W)) camera.target = Vector3Add(camera.target, Vector3Scale(forward, moveSpeed));
    if (IsKeyDown(KEY_S)) camera.target = Vector3Add(camera.target, Vector3Scale(forward, -moveSpeed));
    if (IsKeyDown(KEY_A)) camera.target = Vector3Add(camera.target, Vector3Scale(right, -moveSpeed));
    if (IsKeyDown(KEY_D)) camera.target = Vector3Add(camera.target, Vector3Scale(right, moveSpeed));
    if (IsKeyDown(KEY_Q)) camera.target = Vector3Add(camera.target, Vector3Scale(worldUp, -moveSpeed));
    if (IsKeyDown(KEY_E)) camera.target = Vector3Add(camera.target, Vector3Scale(worldUp, moveSpeed));

    const Vector3 offsets = {
        orbitDistance * cosf(orbitPitch) * sinf(orbitYaw),
        orbitDistance * sinf(orbitPitch),
        orbitDistance * cosf(orbitPitch) * cosf(orbitYaw)};
    camera.position = Vector3Add(camera.target, offsets);
    camera.up = worldUp;

    BeginDrawing();
    ClearBackground(RAYWHITE);

    BeginMode3D(camera);
    DrawXZGrid(40, 0.5f, Fade(LIGHTGRAY, 0.4f));
    DrawAxes(2.0f);
    DrawModel(model, {0.0f, 0.0f, 0.0f}, 1.0f, WHITE);
    DrawModelWires(model, {0.0f, 0.0f, 0.0f}, 1.001f, kWireColor);
    EndMode3D();

    const float margin = 20.0f;
    const Vector2 textSize = MeasureTextEx(brandingFont, kBrandText, kBrandFontSize, 0.0f);
    const Vector2 brandPos = {
        static_cast<float>(GetScreenWidth()) - textSize.x - margin,
        margin};
    DrawTextEx(brandingFont, kBrandText, brandPos, kBrandFontSize, 0.0f, DARKGRAY);

    if (!statusMessage.empty()) {
      constexpr float statusFontSize = 18.0f;
      const Vector2 statusPos = {margin, margin};
      DrawTextEx(brandingFont, statusMessage.c_str(), statusPos, statusFontSize, 0.0f, DARKGRAY);
    }

    EndDrawing();
  }

  DestroyModel(model);
  if (brandingFontCustom) {
    UnloadFont(brandingFont);
  }
  JS_FreeRuntime(runtime);
  CloseWindow();

  return 0;
}

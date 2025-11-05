#include "raylib.h"
#include "raymath.h"
#include "rlgl.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#include <cstring>
#endif

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
#include <utility>

extern "C" {
#include "quickjs.h"
}

#include "manifold/manifold.h"
#include "manifold/polygon.h"
#include "js_bindings.h"

// Version header (generated at build time)
#ifdef BUILD_VERSION
#include "version.h"
#else
#define BUILD_VERSION "dev"
#define BUILD_DATE "unknown"
#define BUILD_COMMIT "unknown"
#endif

namespace {
#ifdef __EMSCRIPTEN__
// Log build version to console on initialization
extern "C" {
EMSCRIPTEN_KEEPALIVE
void logBuildVersion() {
  EM_ASM({
    console.log('═══════════════════════════════════════');
    console.log('🚀 DingCAD Web Viewer');
    console.log('📦 Build Version: ' + UTF8ToString($0));
    console.log('📅 Build Date: ' + UTF8ToString($1));
    console.log('🔖 Commit: ' + UTF8ToString($2));
    console.log('═══════════════════════════════════════');
  }, BUILD_VERSION, BUILD_DATE, BUILD_COMMIT);
}
}
#endif
const Color kBaseColor = {210, 210, 220, 255};
const char *kBrandText = "dingcad";
constexpr float kBrandFontSize = 28.0f;
constexpr float kSceneScale = 0.1f;  // convert mm scene units to renderer units

// GLSL 330 core (desktop). Uses raylib's default attribute/uniform names.
const char* kOutlineVS = R"glsl(
#version 330

in vec3 vertexPosition;
in vec3 vertexNormal;

uniform mat4 mvp;
uniform float outline;   // world-units thickness

void main()
{
    // Expand along the vertex normal in model space. This is robust as long as
    // your model transform has no non-uniform scale (true in your code).
    vec3 pos = vertexPosition + normalize(vertexNormal) * outline;
    gl_Position = mvp * vec4(pos, 1.0);
}
)glsl";

const char* kOutlineFS = R"glsl(
#version 330

out vec4 finalColor;
uniform vec4 outlineColor;

void main()
{
    // Keep only back-faces for a clean silhouette.
    if (gl_FrontFacing) discard;
    finalColor = outlineColor;
}
)glsl";

// Toon (cel) shading — lit 3D pass
const char* kToonVS = R"glsl(
#version 330
in vec3 vertexPosition;
in vec3 vertexNormal;
uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matView;
out vec3 vNvs;
out vec3 vVdir; // view dir in view space
void main() {
    vec4 wpos = matModel * vec4(vertexPosition, 1.0);
    vec3 nvs  = mat3(matView) * mat3(matModel) * vertexNormal;
    vNvs      = normalize(nvs);
    vec3 vpos = (matView * wpos).xyz;
    vVdir     = normalize(-vpos);
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

const char* kToonFS = R"glsl(
#version 330
in vec3 vNvs;
in vec3 vVdir;
out vec4 finalColor;

uniform vec3 lightDirVS;     // normalized, in view space
uniform vec4 baseColor;      // your kBaseColor normalized [0..1]
uniform int  toonSteps;      // e.g. 3 or 4
uniform float ambient;       // e.g. 0.3
uniform float diffuseWeight; // e.g. 0.7
uniform float rimWeight;     // e.g. 0.25
uniform float specWeight;    // e.g. 0.15
uniform float specShininess; // e.g. 32.0

float quantize(float x, int steps){
    float s = max(1, steps-1);
    return floor(clamp(x,0.0,1.0)*s + 1e-4)/s;
}

void main() {
    vec3 n   = normalize(vNvs);
    vec3 l   = normalize(lightDirVS);
    vec3 v   = normalize(vVdir);

    float ndl = max(0.0, dot(n,l));
    float cel = quantize(ndl, toonSteps);

    // crisp rim
    float rim = pow(1.0 - max(0.0, dot(n, v)), 1.5);

    // hard-edged spec
    float spec = pow(max(0.0, dot(reflect(-l, n), v)), specShininess);
    spec = step(0.5, spec) * specWeight;

    float shade = clamp(ambient + diffuseWeight*cel + rimWeight*rim + spec, 0.0, 1.0);
    finalColor  = vec4(baseColor.rgb * shade, 1.0);
}
)glsl";

// Normal+Depth G-buffer — for screen-space edges
const char* kNormalDepthVS = R"glsl(
#version 330
in vec3 vertexPosition;
in vec3 vertexNormal;
uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matView;
out vec3 nVS;
out float depthLin;
void main() {
    vec4 wpos = matModel * vec4(vertexPosition, 1.0);
    vec3 vpos = (matView * wpos).xyz;
    nVS = normalize(mat3(matView) * mat3(matModel) * vertexNormal);
    depthLin = -vpos.z; // linear view-space depth
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

const char* kNormalDepthFS = R"glsl(
#version 330
in vec3 nVS;
in float depthLin;
out vec4 outColor;
uniform float zNear;
uniform float zFar;
void main() {
    float d = clamp((depthLin - zNear) / (zFar - zNear), 0.0, 1.0);
    outColor = vec4(nVS*0.5 + 0.5, d); // RGB: normal, A: linear depth
}
)glsl";

// Fullscreen composite — ink from normal/depth discontinuities
const char* kEdgeQuadVS = R"glsl(
#version 330
in vec3 vertexPosition;
in vec2 vertexTexCoord;
uniform mat4 mvp;
out vec2 uv;
void main() {
    uv = vertexTexCoord;
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

const char* kEdgeFS = R"glsl(
#version 330
in vec2 uv;
out vec4 finalColor;

uniform sampler2D texture0;      // color from toon pass
uniform sampler2D normDepthTex;  // RG: normal, A: depth from ND pass
uniform vec2 texel;              // 1/width, 1/height

uniform float normalThreshold;   // e.g. 0.25
uniform float depthThreshold;    // e.g. 0.002
uniform float edgeIntensity;     // e.g. 1.0
uniform vec4 inkColor;           // usually black

vec3 decodeN(vec3 c){ return normalize(c*2.0 - 1.0); }

void main(){
    vec4 col = texture(texture0, uv);
    vec4 nd  = texture(normDepthTex, uv);
    vec3 n   = decodeN(nd.rgb);
    float d  = nd.a;

    const vec2 offs[8] = vec2[](vec2(-1,-1), vec2(0,-1), vec2(1,-1),
                                vec2(-1, 0),              vec2(1, 0),
                                vec2(-1, 1), vec2(0, 1), vec2(1, 1));
    float maxNDiff = 0.0;
    float maxDDiff = 0.0;
    for (int i=0;i<8;i++){
        vec4 ndn = texture(normDepthTex, uv + offs[i]*texel);
        maxNDiff = max(maxNDiff, length(n - decodeN(ndn.rgb)));
        maxDDiff = max(maxDDiff, abs(d - ndn.a));
    }

    float eN = smoothstep(normalThreshold, normalThreshold*2.5, maxNDiff);
    float eD = smoothstep(depthThreshold,  depthThreshold*6.0,  maxDDiff);
    float edge = clamp(max(eN, eD)*edgeIntensity, 0.0, 1.0);

    vec3 inked = mix(col.rgb, inkColor.rgb, edge);
    finalColor = vec4(inked, col.a);
}
)glsl";

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
#ifdef __EMSCRIPTEN__
  // For web, look in virtual filesystem
  const char* virtualPaths[] = {"/scene.js", "/home/scene.js"};
  for (const char* vpath : virtualPaths) {
    FILE* test = fopen(vpath, "r");
    if (test) {
      fclose(test);
      return std::filesystem::path(vpath);
    }
  }
  return std::nullopt;
#else
  auto cwdCandidate = std::filesystem::current_path() / "scene.js";
  if (std::filesystem::exists(cwdCandidate)) return cwdCandidate;
  if (const char *home = std::getenv("HOME")) {
    std::filesystem::path homeCandidate = std::filesystem::path(home) / "scene.js";
    if (std::filesystem::exists(homeCandidate)) return homeCandidate;
  }
  return std::nullopt;
#endif
}

std::optional<std::string> ReadTextFile(const std::filesystem::path &path) {
#ifdef __EMSCRIPTEN__
  // Use Emscripten's virtual filesystem for web
  FILE* file = fopen(path.string().c_str(), "r");
  if (!file) return std::nullopt;
  std::string content;
  char buffer[4096];
  while (fgets(buffer, sizeof(buffer), file)) {
    content += buffer;
  }
  fclose(file);
  return content;
#else
  std::ifstream file(path);
  if (!file) return std::nullopt;
  std::ostringstream ss;
  ss << file.rdbuf();
  return ss.str();
#endif
}

// Track modules being loaded to prevent recursion
static std::set<std::string> g_loading_modules;

// Dummy module loader that returns an empty module during compilation
// This prevents QuickJS from recursing when trying to resolve imports during compilation
// The real resolution will happen later during JS_ResolveModule
JSModuleDef *DummyModuleLoader(JSContext *ctx, const char *module_name, void *opaque) {
  std::string modName(module_name);
  
  // Check if we're already loading this module to prevent recursion
  if (g_loading_modules.find(modName) != g_loading_modules.end()) {
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ Recursion detected in DummyModuleLoader for:', UTF8ToString($0));
    }, module_name);
#endif
    // Return nullptr to break recursion - QuickJS will handle the error
    return nullptr;
  }
  
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.warn('⚠️ DummyModuleLoader called during compilation for:', UTF8ToString($0));
  }, module_name);
#endif
  
  // Mark as loading
  g_loading_modules.insert(modName);
  
  // Create a minimal empty module WITHOUT calling JS_Eval (which would trigger the loader again)
  // Instead, we'll create a module using QuickJS's internal APIs
  // But since we can't easily do that, let's just return nullptr and let QuickJS handle it
  // The key is to prevent infinite recursion by not calling JS_Eval here
  
  // Remove from loading set before returning
  g_loading_modules.erase(modName);
  
  // Return nullptr - this will cause QuickJS to throw an error, but that's better than recursion
  // The error will be caught and handled properly during JS_ResolveModule
  JS_ThrowReferenceError(ctx, "Module '%s' cannot be loaded during compilation (deferred to resolution phase)", module_name);
  return nullptr;
}

JSModuleDef *FilesystemModuleLoader(JSContext *ctx, const char *module_name, void *opaque) {
  auto *data = static_cast<ModuleLoaderData *>(opaque);
  
  // Ignore special inline module names that shouldn't go through the filesystem loader
  // These are used for inline code evaluation and shouldn't trigger filesystem resolution
  if (strncmp(module_name, "<", 1) == 0 || strncmp(module_name, "/dev/", 5) == 0) {
    // This is an inline module (like <inline-scene>, <cmdline>, or /dev/stdin)
    // QuickJS uses these for inline code and shouldn't try to load them via filesystem
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.warn('⚠️ ModuleLoader called for inline module:', UTF8ToString($0), '- this should not happen during compilation');
    }, module_name);
#endif
    JS_ThrowReferenceError(ctx, "Module '%s' is an inline module and cannot be loaded via filesystem", module_name);
    return nullptr;
  }
  
  std::filesystem::path resolved(module_name);
  if (resolved.is_relative()) {
    const std::filesystem::path base = data && !data->baseDir.empty()
                                           ? data->baseDir
                                           : std::filesystem::current_path();
    resolved = base / resolved;
  }
  resolved = std::filesystem::absolute(resolved).lexically_normal();

#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('📦 ModuleLoader called for:', UTF8ToString($0));
    console.log('📦 Current dependencies count:', $1);
  }, resolved.string().c_str(), data ? data->dependencies.size() : 0);
#endif

  // Check for circular dependency to prevent stack overflow
  if (data && data->dependencies.find(resolved) != data->dependencies.end()) {
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('⚠️ Circular dependency detected:', UTF8ToString($0));
    }, resolved.string().c_str());
#endif
    JS_ThrowReferenceError(ctx, "Circular dependency detected: module '%s' is already being loaded", resolved.string().c_str());
    return nullptr;
  }

  if (data) {
    data->baseDir = resolved.parent_path();
    data->dependencies.insert(resolved);
  }

  auto source = ReadTextFile(resolved);
  if (!source) {
    JS_ThrowReferenceError(ctx, "Unable to load module '%s'", resolved.string().c_str());
    if (data) {
      data->dependencies.erase(resolved);
    }
    return nullptr;
  }

  const std::string moduleName = resolved.string();
  
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('🔨 Compiling module in loader:', UTF8ToString($0), 'size:', $1);
  }, moduleName.c_str(), source->size());
#endif
  
  JSValue funcVal = JS_Eval(ctx, source->c_str(), source->size(), moduleName.c_str(),
                            JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(funcVal)) {
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ Module compilation failed in loader:', UTF8ToString($0));
    }, moduleName.c_str());
#endif
    if (data) {
      data->dependencies.erase(resolved);
    }
    return nullptr;
  }

  auto *module = static_cast<JSModuleDef *>(JS_VALUE_GET_PTR(funcVal));
  JS_FreeValue(ctx, funcVal);
  
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('✅ Module loaded successfully:', UTF8ToString($0));
  }, moduleName.c_str());
#endif
  
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

// Global state for runtime scene loading (used by Emscripten exports)
struct GlobalState {
  JSRuntime *runtime = nullptr;
  std::shared_ptr<manifold::Manifold> *scene = nullptr;
  Model *model = nullptr;
  std::string *statusMessage = nullptr;
  // Camera state pointers
  Camera3D *camera = nullptr;
  float *orbitYaw = nullptr;
  float *orbitPitch = nullptr;
  float *orbitDistance = nullptr;
  Vector3 *initialTarget = nullptr;
  float *initialDistance = nullptr;
  float *initialYaw = nullptr;
  float *initialPitch = nullptr;
};

GlobalState g_state;

LoadResult LoadSceneFromCode(JSRuntime *runtime, const std::string &code) {
  LoadResult result;
  
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('📝 LoadSceneFromCode: Starting scene load, code size:', $0, 'bytes');
    if ($0 > 0 && $1) {
      const fullCode = UTF8ToString($1);
      const preview = fullCode.substring(0, Math.min(200, fullCode.length));
      const display = fullCode.length > 200 ? preview + '...' : preview;
      console.log('📝 Code preview:', display);
    }
  }, code.size(), code.empty() ? nullptr : code.c_str());
#endif
  
  if (code.empty()) {
    result.message = "Error: No code provided. The scene code is empty.";
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ LoadSceneFromCode: Code is empty');
    });
#endif
    return result;
  }
  
#ifdef __EMSCRIPTEN__
  // Write code to virtual filesystem
  const char* virtualPath = "/tmp/scene.js";
  EM_ASM({
    console.log('💾 Writing code to virtual filesystem:', UTF8ToString($0));
  }, virtualPath);
  FILE* file = fopen(virtualPath, "w");
  if (!file) {
    result.message = "Error: Unable to write to virtual filesystem at " + std::string(virtualPath);
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ LoadSceneFromCode: Failed to open file for writing');
    });
#endif
    return result;
  }
  size_t written = fwrite(code.c_str(), 1, code.size(), file);
  fclose(file);
  if (written != code.size()) {
    result.message = "Error: Failed to write all code to virtual filesystem (wrote " + 
                     std::to_string(written) + " of " + std::to_string(code.size()) + " bytes)";
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ LoadSceneFromCode: Incomplete write');
    });
#endif
    return result;
  }
  EM_ASM({
    console.log('✅ Code written to virtual filesystem');
  });
  
  // Load from virtual file
  std::filesystem::path scriptPath(virtualPath);
#else
  // For desktop, write to temp file
  std::filesystem::path tempPath = std::filesystem::temp_directory_path() / "dingcad_scene.js";
  std::ofstream outFile(tempPath);
  if (!outFile) {
    result.message = "Error: Unable to write temporary file to " + tempPath.string();
    return result;
  }
  outFile << code;
  outFile.close();
  std::filesystem::path scriptPath = tempPath;
#endif

  // Clear and initialize module loader data to prevent circular dependencies
  g_module_loader_data.baseDir = scriptPath.parent_path();
  g_module_loader_data.dependencies.clear();
  // Don't insert scriptPath here - it will be added by the module loader if needed
  // This prevents the module loader from thinking we're already loading this module
  
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('🔧 Creating JS context and registering bindings');
  });
#endif
  JSContext *ctx = JS_NewContext(runtime);
  if (!ctx) {
    result.message = "Error: Failed to create JavaScript context";
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ LoadSceneFromCode: Failed to create JS context');
    });
#endif
    return result;
  }
  RegisterBindings(ctx);

  auto captureException = [&](const char* step) {
    JSValue exc = JS_GetException(ctx);
    std::string errorMsg;
    
    // Check what type of exception we have
    int tag = JS_VALUE_GET_TAG(exc);
    bool isError = JS_IsError(ctx, exc);
    
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('🔍 Exception type tag:', $0, 'isError:', $1);
    }, tag, isError ? 1 : 0);
#endif
    
    // Try to get a simple error message first to avoid recursion
    // If we get a stack overflow error, trying to extract details might cause more recursion
    const char *excStr = nullptr;
    try {
      excStr = JS_ToCString(ctx, exc);
      if (excStr && strlen(excStr) > 0) {
        errorMsg = excStr;
        // Check if this is a stack overflow error - if so, don't try to get more details
        if (errorMsg.find("Maximum call stack size exceeded") != std::string::npos ||
            errorMsg.find("stack size exceeded") != std::string::npos) {
          JS_FreeCString(ctx, excStr);
          result.message = std::string(step) + ": " + errorMsg + " (preventing further recursion)";
#ifdef __EMSCRIPTEN__
          EM_ASM({
            console.error('❌ LoadSceneFromCode error at step:', UTF8ToString($0));
            console.error('❌ Error details:', UTF8ToString($1));
          }, step, errorMsg.c_str());
#endif
          JS_FreeValue(ctx, exc);
          return; // Early return to avoid any property access that might cause recursion
        }
      }
      if (excStr) JS_FreeCString(ctx, excStr);
    } catch (...) {
      // If even converting to string fails, use a fallback
      if (excStr) JS_FreeCString(ctx, excStr);
      errorMsg = "Error extracting exception details (exception access failed)";
    }
    
    // Only try to get more details if we didn't get a stack overflow error
    if (isError && errorMsg.find("Maximum call stack size exceeded") == std::string::npos) {
      // Try to get name property first (error type)
      JSValue name = JS_GetPropertyStr(ctx, exc, "name");
      if (!JS_IsUndefined(name) && !JS_IsException(name)) {
        const char *nameStr = JS_ToCString(ctx, name);
        if (nameStr && strlen(nameStr) > 0) {
          if (!errorMsg.empty()) {
            errorMsg = std::string(nameStr) + ": " + errorMsg;
          } else {
            errorMsg = std::string(nameStr);
          }
        }
        if (nameStr) JS_FreeCString(ctx, nameStr);
      }
      JS_FreeValue(ctx, name);
      
      // Try to get message property (but limit length to avoid huge messages)
      JSValue message = JS_GetPropertyStr(ctx, exc, "message");
      if (!JS_IsUndefined(message) && !JS_IsException(message)) {
        const char *msgStr = JS_ToCString(ctx, message);
        if (msgStr && strlen(msgStr) > 0 && strlen(msgStr) < 1000) { // Limit message length
          if (!errorMsg.empty()) {
            errorMsg += " - " + std::string(msgStr);
          } else {
            errorMsg = std::string(msgStr);
          }
        }
        if (msgStr) JS_FreeCString(ctx, msgStr);
      }
      JS_FreeValue(ctx, message);
    }
    
    // If we still have no message, use a fallback with diagnostic info
    if (errorMsg.empty()) {
      errorMsg = "Unknown JavaScript error (tag=" + std::to_string(tag) + 
                 ", isError=" + (isError ? "true" : "false") + ")";
    }
    
    result.message = std::string(step) + ": " + errorMsg;
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ LoadSceneFromCode error at step:', UTF8ToString($0));
      console.error('❌ Error details:', UTF8ToString($1));
    }, step, errorMsg.c_str());
#endif
    JS_FreeValue(ctx, exc);
  };

#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('🔨 Step 1: Compiling JavaScript module');
    console.log('📝 Code size:', $0, 'bytes');
  }, code.size());
#endif
  
  // Use /dev/stdin as filename - QuickJS has special handling for this
  // It checks for "/dev/" prefix and won't try to resolve it as a real path
  // This should prevent any filesystem resolution attempts during compilation
  const char* evalFilename = "/dev/stdin";
  
  // COMPLETELY disable module loader during compilation
  // QuickJS should not call the module loader during compilation with COMPILE_ONLY,
  // but if it does, having no loader should prevent recursion
  JS_SetModuleLoaderFunc(runtime, nullptr, nullptr, nullptr);
  
  // Try compiling the module
  // With no module loader set, QuickJS should compile without trying to resolve imports
  // Import resolution will happen later during JS_ResolveModule
  JSValue moduleFunc = JS_Eval(ctx, code.c_str(), code.size(), evalFilename,
                               JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  
  // Re-enable module loader ONLY after compilation succeeds, for JS_ResolveModule
  if (!JS_IsException(moduleFunc)) {
    JS_SetModuleLoaderFunc(runtime, nullptr, FilesystemModuleLoader, &g_module_loader_data);
  }
  
  if (JS_IsException(moduleFunc)) {
    captureException("Step 1: Compilation failed");
    JS_FreeContext(ctx);
    return result;
  }
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('✅ Step 1: Module compiled successfully');
    console.log('🔨 Step 2: Resolving module dependencies');
  });
#endif

  // Now resolve module dependencies (this will use the module loader if there are imports)
  if (JS_ResolveModule(ctx, moduleFunc) < 0) {
    captureException("Step 2: Module resolution failed");
    JS_FreeContext(ctx);
    return result;
  }
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('✅ Step 2: Module dependencies resolved');
    console.log('🔨 Step 3: Evaluating module code');
  });
#endif

  auto *module = static_cast<JSModuleDef *>(JS_VALUE_GET_PTR(moduleFunc));
  JSValue evalResult = JS_EvalFunction(ctx, moduleFunc);
  if (JS_IsException(evalResult)) {
    captureException("Step 3: Module evaluation failed");
    JS_FreeContext(ctx);
    return result;
  }
  JS_FreeValue(ctx, evalResult);
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('✅ Step 3: Module evaluated successfully');
    console.log('🔨 Step 4: Getting module namespace');
  });
#endif

  JSValue moduleNamespace = JS_GetModuleNamespace(ctx, module);
  if (JS_IsException(moduleNamespace)) {
    captureException("Step 4: Failed to get module namespace");
    JS_FreeContext(ctx);
    return result;
  }
#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('✅ Step 4: Module namespace retrieved');
    console.log('🔨 Step 5: Getting scene export from module');
  });
#endif

  JSValue sceneVal = JS_GetPropertyStr(ctx, moduleNamespace, "scene");
  if (JS_IsException(sceneVal)) {
    JS_FreeValue(ctx, moduleNamespace);
    captureException("Step 5: Failed to get 'scene' export from module");
    JS_FreeContext(ctx);
    return result;
  }

  // If scene is undefined, try to find and call a default export function
  if (JS_IsUndefined(sceneVal)) {
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.warn('⚠️ Step 5: Scene export is undefined, trying default export');
    });
#endif
    JS_FreeValue(ctx, sceneVal);
    
    // Try to get default export
    JSValue defaultExport = JS_GetPropertyStr(ctx, moduleNamespace, "default");
    if (!JS_IsUndefined(defaultExport) && JS_IsFunction(ctx, defaultExport)) {
#ifdef __EMSCRIPTEN__
      EM_ASM({
        console.log('🔨 Step 5b: Calling default export function');
      });
#endif
      // Default export is a function, try calling it
      JSValue callResult = JS_Call(ctx, defaultExport, JS_UNDEFINED, 0, nullptr);
      if (JS_IsException(callResult)) {
        JS_FreeValue(ctx, defaultExport);
        JS_FreeValue(ctx, moduleNamespace);
        captureException("Step 5b: Calling default export function failed");
        JS_FreeContext(ctx);
        return result;
      }
      sceneVal = callResult;
      JS_FreeValue(ctx, defaultExport);
#ifdef __EMSCRIPTEN__
      EM_ASM({
        console.log('✅ Step 5b: Default export function called successfully');
      });
#endif
    } else {
      JS_FreeValue(ctx, defaultExport);
      JS_FreeValue(ctx, moduleNamespace);
      JS_FreeContext(ctx);
      result.message = "Error: Scene module must export 'scene'. The module was evaluated but no 'scene' export was found. Try: export const scene = cube({ size: [1, 1, 1] });";
#ifdef __EMSCRIPTEN__
      EM_ASM({
        console.error('❌ Step 5: No scene export found, and no default export function available');
      });
#endif
      return result;
    }
  } else {
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.log('✅ Step 5: Scene export found');
    });
#endif
  }
  JS_FreeValue(ctx, moduleNamespace);

#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('🔨 Step 6: Converting scene value to manifold');
  });
#endif
  auto sceneHandle = GetManifoldHandle(ctx, sceneVal);
  if (!sceneHandle) {
    // Get type information for better error message
    int tag = JS_VALUE_GET_TAG(sceneVal);
    const char* typeStr = "unknown";
    if (tag == JS_TAG_UNDEFINED) typeStr = "undefined";
    else if (tag == JS_TAG_NULL) typeStr = "null";
    else if (tag == JS_TAG_BOOL) typeStr = "boolean";
    else if (tag == JS_TAG_INT) typeStr = "number (int)";
    else if (tag == JS_TAG_FLOAT64) typeStr = "number (float)";
    else if (tag == JS_TAG_STRING) typeStr = "string";
    else if (tag == JS_TAG_OBJECT) {
      // Try to get constructor name
      JSValue constructor = JS_GetPropertyStr(ctx, sceneVal, "constructor");
      if (!JS_IsUndefined(constructor)) {
        JSValue name = JS_GetPropertyStr(ctx, constructor, "name");
        if (!JS_IsUndefined(name)) {
          const char* nameStr = JS_ToCString(ctx, name);
          if (nameStr) {
            typeStr = nameStr;
            JS_FreeCString(ctx, nameStr);
          }
          JS_FreeValue(ctx, name);
        }
        JS_FreeValue(ctx, constructor);
      }
      if (strcmp(typeStr, "unknown") == 0 || strcmp(typeStr, "Object") == 0) {
        typeStr = "object (not a manifold)";
      }
    }
    
    JS_FreeValue(ctx, sceneVal);
    JS_FreeContext(ctx);
    result.message = "Error: Exported 'scene' is not a manifold (got: " + std::string(typeStr) + "). Make sure the function returns a valid manifold object created with cube(), sphere(), etc.";
#ifdef __EMSCRIPTEN__
    EM_ASM({
      console.error('❌ Step 6: Scene value is not a manifold, type:', UTF8ToString($0));
    }, typeStr);
#endif
    return result;
  }

#ifdef __EMSCRIPTEN__
  EM_ASM({
    console.log('✅ Step 6: Scene converted to manifold successfully');
    console.log('🎉 All steps completed - scene loaded successfully!');
  });
#endif
  result.manifold = sceneHandle;
  result.success = true;
  result.message = "Scene loaded successfully";
  JS_FreeValue(ctx, sceneVal);
  JS_FreeContext(ctx);
  return result;
}

#ifdef __EMSCRIPTEN__
extern "C" {
// Emscripten export to get the current status message
EMSCRIPTEN_KEEPALIVE
const char* getStatusMessage() {
  if (!g_state.statusMessage) {
    return "Status not initialized";
  }
  return g_state.statusMessage->c_str();
}

// Emscripten export to load scene from JavaScript code string
EMSCRIPTEN_KEEPALIVE
void loadSceneFromCode(const char* code) {
  if (!code) {
    EM_ASM({
      console.error('❌ loadSceneFromCode: Code pointer is null');
    });
    return;
  }
  
  if (!g_state.runtime || !g_state.scene || !g_state.model || !g_state.statusMessage) {
    EM_ASM({
      console.error('❌ loadSceneFromCode: Global state not initialized');
      console.error('  - runtime:', $0 ? 'initialized' : 'null');
      console.error('  - scene:', $1 ? 'initialized' : 'null');
      console.error('  - model:', $2 ? 'initialized' : 'null');
      console.error('  - statusMessage:', $3 ? 'initialized' : 'null');
    }, g_state.runtime, g_state.scene, g_state.model, g_state.statusMessage);
    return;
  }
  
  EM_ASM({
    console.log('🚀 loadSceneFromCode called, code length:', $0);
  }, strlen(code));
  
  auto load = LoadSceneFromCode(g_state.runtime, std::string(code));
  if (load.success) {
    if (!load.manifold) {
      *g_state.statusMessage = "Error: Scene loaded but manifold is null";
      EM_ASM({
        console.error('❌ Scene loaded but manifold is null');
      });
      return;
    }
    
    *g_state.scene = load.manifold;
    bool replaced = ReplaceScene(*g_state.model, *g_state.scene);
    if (!replaced) {
      *g_state.statusMessage = "Error: Failed to replace model with new scene";
      EM_ASM({
        console.error('❌ Failed to replace model');
      });
      return;
    }
    
    *g_state.statusMessage = "Scene loaded successfully";
    EM_ASM({
      console.log('✅ Scene loaded and model replaced successfully');
    });
  } else {
    // Ensure we always have a meaningful error message
    std::string errorMsg = load.message.empty() 
      ? "Unknown error: Scene loading failed but no error message was provided"
      : load.message;
    
    *g_state.statusMessage = errorMsg;
    EM_ASM({
      console.error('❌ Failed to load scene');
      const msg = UTF8ToString($0);
      if (msg && msg.length > 0) {
        console.error('❌ Error message:', msg);
      } else {
        console.error('❌ Error message: (empty or null)');
      }
    }, errorMsg.c_str());
  }
}

// Camera state getters
EMSCRIPTEN_KEEPALIVE
float getCameraYaw() {
  return g_state.orbitYaw ? *g_state.orbitYaw : 0.0f;
}

EMSCRIPTEN_KEEPALIVE
float getCameraPitch() {
  return g_state.orbitPitch ? *g_state.orbitPitch : 0.0f;
}

EMSCRIPTEN_KEEPALIVE
float getCameraDistance() {
  return g_state.orbitDistance ? *g_state.orbitDistance : 1.0f;
}

EMSCRIPTEN_KEEPALIVE
void getCameraTarget(float *x, float *y, float *z) {
  if (g_state.camera && x && y && z) {
    *x = g_state.camera->target.x;
    *y = g_state.camera->target.y;
    *z = g_state.camera->target.z;
  }
}

// Camera state setters
EMSCRIPTEN_KEEPALIVE
void setCameraYaw(float yaw) {
  if (g_state.orbitYaw) {
    *g_state.orbitYaw = yaw;
  }
}

EMSCRIPTEN_KEEPALIVE
void setCameraPitch(float pitch) {
  if (g_state.orbitPitch) {
    const float limit = DEG2RAD * 89.0f;
    *g_state.orbitPitch = Clamp(pitch, -limit, limit);
  }
}

EMSCRIPTEN_KEEPALIVE
void setCameraDistance(float distance) {
  if (g_state.orbitDistance) {
    *g_state.orbitDistance = Clamp(distance, 1.0f, 50.0f);
  }
}

EMSCRIPTEN_KEEPALIVE
void setCameraTarget(float x, float y, float z) {
  if (g_state.camera) {
    g_state.camera->target = {x, y, z};
  }
}

EMSCRIPTEN_KEEPALIVE
void resetCamera() {
  if (g_state.orbitYaw && g_state.orbitPitch && g_state.orbitDistance &&
      g_state.initialTarget && g_state.initialDistance &&
      g_state.initialYaw && g_state.initialPitch && g_state.camera) {
    g_state.camera->target = *g_state.initialTarget;
    *g_state.orbitDistance = *g_state.initialDistance;
    *g_state.orbitYaw = *g_state.initialYaw;
    *g_state.orbitPitch = *g_state.initialPitch;
  }
}

EMSCRIPTEN_KEEPALIVE
void updateCameraPosition() {
  if (g_state.camera && g_state.orbitYaw && g_state.orbitPitch && g_state.orbitDistance) {
    const Vector3 offsets = {
        *g_state.orbitDistance * cosf(*g_state.orbitPitch) * sinf(*g_state.orbitYaw),
        *g_state.orbitDistance * sinf(*g_state.orbitPitch),
        *g_state.orbitDistance * cosf(*g_state.orbitPitch) * cosf(*g_state.orbitYaw)};
    g_state.camera->position = Vector3Add(g_state.camera->target, offsets);
    g_state.camera->up = {0.0f, 1.0f, 0.0f};
  }
}
}
#endif

}  // namespace

int main() {
  // Guard against double initialization (especially important for Emscripten)
  static bool initialized = false;
  if (initialized) {
    TraceLog(LOG_WARNING, "main() called multiple times, skipping re-initialization");
    return 0;
  }
  initialized = true;

#ifdef __EMSCRIPTEN__
  // Log build version to console
  logBuildVersion();
#endif

  SetConfigFlags(FLAG_MSAA_4X_HINT | FLAG_WINDOW_RESIZABLE);
  
  // Check if window is already initialized before creating a new one
  if (!IsWindowReady()) {
    InitWindow(1280, 720, "dingcad");
  } else {
    TraceLog(LOG_WARNING, "Window already initialized, skipping InitWindow");
  }
  
  SetTargetFPS(60);

  // Use default font for everything
  Font defaultFont = GetFontDefault();

  Camera3D camera = {0};
  // Position camera much closer for a tighter zoom on the WesWorld logo
  camera.position = {1.2f, 1.2f, 1.2f};  // Zoomed in closer
  camera.target = {0.0f, 0.0f, 0.0f};  // Center on logo
  camera.up = {0.0f, 1.0f, 0.0f};
  camera.fovy = 45.0f;
  camera.projection = CAMERA_PERSPECTIVE;

  float orbitDistance = Vector3Distance(camera.position, camera.target);
  float orbitYaw = atan2f(camera.position.x - camera.target.x,
                          camera.position.z - camera.target.z);
  float orbitPitch = asinf((camera.position.y - camera.target.y) / orbitDistance);
  Vector3 initialTarget = camera.target;
  float initialDistance = orbitDistance;
  float initialYaw = orbitYaw;
  float initialPitch = orbitPitch;

  JSRuntime *runtime = JS_NewRuntime();
  EnsureManifoldClass(runtime);
  JS_SetModuleLoaderFunc(runtime, nullptr, FilesystemModuleLoader, &g_module_loader_data);

  std::shared_ptr<manifold::Manifold> scene = nullptr;
  
#ifdef __EMSCRIPTEN__
  // Setup global state for Emscripten exports
  g_state.runtime = runtime;
  g_state.scene = &scene;
#endif
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
    // Create empty scene (tiny invisible cube) instead of default logo
    // This ensures the model can be created without crashing
    manifold::Manifold emptyScene = manifold::Manifold::Cube({0.001, 0.001, 0.001}, true);
    scene = std::make_shared<manifold::Manifold>(emptyScene);
    if (statusMessage.empty()) {
      reportStatus("Ready - no scene loaded.");
    }
  }

  Model model = CreateRaylibModelFrom(scene->GetMeshGL());

#ifdef __EMSCRIPTEN__
  // Complete global state setup
  g_state.model = &model;
  g_state.statusMessage = &statusMessage;
  g_state.camera = &camera;
  g_state.orbitYaw = &orbitYaw;
  g_state.orbitPitch = &orbitPitch;
  g_state.orbitDistance = &orbitDistance;
  g_state.initialTarget = &initialTarget;
  g_state.initialDistance = &initialDistance;
  g_state.initialYaw = &initialYaw;
  g_state.initialPitch = &initialPitch;
#endif

  Shader outlineShader = LoadShaderFromMemory(kOutlineVS, kOutlineFS);
  Shader toonShader = LoadShaderFromMemory(kToonVS, kToonFS);
  Shader normalDepthShader = LoadShaderFromMemory(kNormalDepthVS, kNormalDepthFS);
  Shader edgeShader = LoadShaderFromMemory(kEdgeQuadVS, kEdgeFS);

  if (outlineShader.id == 0 || toonShader.id == 0 || normalDepthShader.id == 0 || edgeShader.id == 0) {
    TraceLog(LOG_ERROR, "Failed to load one or more shaders.");
    DestroyModel(model);
    if (brandingFontCustom) {
      UnloadFont(brandingFont);
    }
    JS_FreeRuntime(runtime);
    CloseWindow();
    return 1;
  }

  // Outline uniforms/material
  const int locOutline = GetShaderLocation(outlineShader, "outline");
  const int locOutlineColor = GetShaderLocation(outlineShader, "outlineColor");
  Material outlineMat = LoadMaterialDefault();
  outlineMat.shader = outlineShader;

  auto setOutlineUniforms = [&](float worldThickness, Color color) {
    float c[4] = {
        color.r / 255.0f,
        color.g / 255.0f,
        color.b / 255.0f,
        color.a / 255.0f};
    SetShaderValue(outlineMat.shader, locOutline, &worldThickness, SHADER_UNIFORM_FLOAT);
    SetShaderValue(outlineMat.shader, locOutlineColor, c, SHADER_UNIFORM_VEC4);
  };

  // Toon shader uniforms/material
  const int locLightDirVS = GetShaderLocation(toonShader, "lightDirVS");
  const int locBaseColor = GetShaderLocation(toonShader, "baseColor");
  const int locToonSteps = GetShaderLocation(toonShader, "toonSteps");
  const int locAmbient = GetShaderLocation(toonShader, "ambient");
  const int locDiffuseWeight = GetShaderLocation(toonShader, "diffuseWeight");
  const int locRimWeight = GetShaderLocation(toonShader, "rimWeight");
  const int locSpecWeight = GetShaderLocation(toonShader, "specWeight");
  const int locSpecShininess = GetShaderLocation(toonShader, "specShininess");
  Material toonMat = LoadMaterialDefault();
  toonMat.shader = toonShader;

  // Normal/depth shader uniforms/material
  const int locNear = GetShaderLocation(normalDepthShader, "zNear");
  const int locFar = GetShaderLocation(normalDepthShader, "zFar");
  Material normalDepthMat = LoadMaterialDefault();
  normalDepthMat.shader = normalDepthShader;

  // Edge composite uniforms
  const int locNormDepthTexture = GetShaderLocation(edgeShader, "normDepthTex");
  const int locTexel = GetShaderLocation(edgeShader, "texel");
  const int locNormalThreshold = GetShaderLocation(edgeShader, "normalThreshold");
  const int locDepthThreshold = GetShaderLocation(edgeShader, "depthThreshold");
  const int locEdgeIntensity = GetShaderLocation(edgeShader, "edgeIntensity");
  const int locInkColor = GetShaderLocation(edgeShader, "inkColor");

  // Static toon lighting configuration
  const Vector3 lightDirWS = Vector3Normalize({0.45f, 0.85f, 0.35f});
  const float baseCol[4] = {
      kBaseColor.r / 255.0f,
      kBaseColor.g / 255.0f,
      kBaseColor.b / 255.0f,
      1.0f};
  SetShaderValue(toonShader, locBaseColor, baseCol, SHADER_UNIFORM_VEC4);
  int toonSteps = 4;
  SetShaderValue(toonShader, locToonSteps, &toonSteps, SHADER_UNIFORM_INT);
  float ambient = 0.35f;
  SetShaderValue(toonShader, locAmbient, &ambient, SHADER_UNIFORM_FLOAT);
  float diffuseWeight = 0.75f;
  SetShaderValue(toonShader, locDiffuseWeight, &diffuseWeight, SHADER_UNIFORM_FLOAT);
  float rimWeight = 0.25f;
  SetShaderValue(toonShader, locRimWeight, &rimWeight, SHADER_UNIFORM_FLOAT);
  float specWeight = 0.12f;
  SetShaderValue(toonShader, locSpecWeight, &specWeight, SHADER_UNIFORM_FLOAT);
  float specShininess = 32.0f;
  SetShaderValue(toonShader, locSpecShininess, &specShininess, SHADER_UNIFORM_FLOAT);

  float normalThreshold = 0.25f;
  float depthThreshold = 0.002f;
  float edgeIntensity = 1.0f;
  SetShaderValue(edgeShader, locNormalThreshold, &normalThreshold, SHADER_UNIFORM_FLOAT);
  SetShaderValue(edgeShader, locDepthThreshold, &depthThreshold, SHADER_UNIFORM_FLOAT);
  SetShaderValue(edgeShader, locEdgeIntensity, &edgeIntensity, SHADER_UNIFORM_FLOAT);
  const Color outlineColor = BLACK;
  const float inkColor[4] = {
      outlineColor.r / 255.0f,
      outlineColor.g / 255.0f,
      outlineColor.b / 255.0f,
      1.0f};
  SetShaderValue(edgeShader, locInkColor, inkColor, SHADER_UNIFORM_VEC4);

  auto makeRenderTargets = [&]() {
    const int width = std::max(GetScreenWidth(), 1);
    const int height = std::max(GetScreenHeight(), 1);
    RenderTexture2D color = LoadRenderTexture(width, height);
    RenderTexture2D normDepth = LoadRenderTexture(width, height);
    return std::make_pair(color, normDepth);
  };

  auto [rtColor, rtNormalDepth] = makeRenderTargets();
  SetShaderValueTexture(edgeShader, locNormDepthTexture, rtNormalDepth.texture);
  const float initialTexel[2] = {
      1.0f / static_cast<float>(rtNormalDepth.texture.width),
      1.0f / static_cast<float>(rtNormalDepth.texture.height)};
  SetShaderValue(edgeShader, locTexel, initialTexel, SHADER_UNIFORM_VEC2);

  int prevScreenWidth = GetScreenWidth();
  int prevScreenHeight = GetScreenHeight();
  const float zNear = 0.01f;
  const float zFar = 1000.0f;

  // Code panel state (DevTools-style)
  bool codePanelVisible = true;  // Start visible
  float codePanelHeight = 0.0f;  // Will be set to half screen when visible

  // Main loop function - extracted for both desktop and web
  auto mainLoop = [&]() {
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

#ifndef __EMSCRIPTEN__
    // File watching only works on desktop, not in browser
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
#endif

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
#ifdef __EMSCRIPTEN__
        // For web, save to virtual filesystem and trigger download
        std::filesystem::path savePath = "/ding.stl";
        std::string error;
        const bool ok = WriteMeshAsBinaryStl(scene->GetMeshGL(), savePath, error);
        if (ok) {
          // Use Emscripten's file download API
          EM_ASM({
            const filename = UTF8ToString($0);
            const path = UTF8ToString($1);
            const data = FS.readFile(path, {encoding: 'binary'});
            const blob = new Blob([data], {type: 'application/octet-stream'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, "ding.stl", savePath.string().c_str());
          reportStatus("Downloaded ding.stl");
        } else {
          reportStatus(error);
        }
#else
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
#endif
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

    // C key toggle removed - panel is now managed through HTML UI

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

    const int screenWidth = std::max(GetScreenWidth(), 1);
    const int screenHeight = std::max(GetScreenHeight(), 1);
    if (screenWidth != prevScreenWidth || screenHeight != prevScreenHeight) {
      UnloadRenderTexture(rtColor);
      UnloadRenderTexture(rtNormalDepth);
      auto resizedTargets = makeRenderTargets();
      rtColor = resizedTargets.first;
      rtNormalDepth = resizedTargets.second;
      SetShaderValueTexture(edgeShader, locNormDepthTexture, rtNormalDepth.texture);
      const float texel[2] = {
          1.0f / static_cast<float>(rtNormalDepth.texture.width),
          1.0f / static_cast<float>(rtNormalDepth.texture.height)};
      SetShaderValue(edgeShader, locTexel, texel, SHADER_UNIFORM_VEC2);
      prevScreenWidth = screenWidth;
      prevScreenHeight = screenHeight;
    }

    // Adjust viewport if code panel is visible (takes bottom half)
    codePanelHeight = codePanelVisible ? screenHeight * 0.5f : 0.0f;
    const int viewportHeight = screenHeight - static_cast<int>(codePanelHeight);
    
    // Set viewport to exclude code panel area
    if (codePanelVisible) {
      rlViewport(0, 0, screenWidth, viewportHeight);
    } else {
      rlViewport(0, 0, screenWidth, screenHeight);
    }

    Matrix view = GetCameraMatrix(camera);
    Vector3 lightDirVS = {
        view.m0 * lightDirWS.x + view.m4 * lightDirWS.y + view.m8 * lightDirWS.z,
        view.m1 * lightDirWS.x + view.m5 * lightDirWS.y + view.m9 * lightDirWS.z,
        view.m2 * lightDirWS.x + view.m6 * lightDirWS.y + view.m10 * lightDirWS.z};
    lightDirVS = Vector3Normalize(lightDirVS);
    SetShaderValue(toonShader, locLightDirVS, &lightDirVS.x, SHADER_UNIFORM_VEC3);

    float outlineThickness = 0.0f;
    {
      const float pixels = 2.0f;
      const float distance = Vector3Distance(camera.position, camera.target);
      const float screenHeightF = static_cast<float>(screenHeight);
      const float worldPerPixel = (screenHeightF > 0.0f)
                                      ? 2.0f * tanf(DEG2RAD * camera.fovy * 0.5f) * distance / screenHeightF
                                      : 0.0f;
      outlineThickness = pixels * worldPerPixel;
    }
    setOutlineUniforms(outlineThickness, outlineColor);

    SetShaderValue(normalDepthShader, locNear, &zNear, SHADER_UNIFORM_FLOAT);
    SetShaderValue(normalDepthShader, locFar, &zFar, SHADER_UNIFORM_FLOAT);

    BeginTextureMode(rtColor);
    ClearBackground(RAYWHITE);
    BeginMode3D(camera);
    DrawXZGrid(40, 0.5f, Fade(LIGHTGRAY, 0.4f));
    DrawAxes(0.3f);  // Much smaller axes so they don't dominate the view

    rlDisableBackfaceCulling();
    for (int i = 0; i < model.meshCount; ++i) {
      DrawMesh(model.meshes[i], outlineMat, model.transform);
    }
    rlEnableBackfaceCulling();

    for (int i = 0; i < model.meshCount; ++i) {
      DrawMesh(model.meshes[i], toonMat, model.transform);
    }
    EndMode3D();
    EndTextureMode();

    BeginTextureMode(rtNormalDepth);
    ClearBackground({127, 127, 255, 0});
    BeginMode3D(camera);
    for (int i = 0; i < model.meshCount; ++i) {
      DrawMesh(model.meshes[i], normalDepthMat, model.transform);
    }
    EndMode3D();
    EndTextureMode();

    BeginDrawing();
    ClearBackground(RAYWHITE);

    const float texel[2] = {
        1.0f / static_cast<float>(rtNormalDepth.texture.width),
        1.0f / static_cast<float>(rtNormalDepth.texture.height)};
    SetShaderValue(edgeShader, locTexel, texel, SHADER_UNIFORM_VEC2);

    BeginShaderMode(edgeShader);
    const Rectangle srcRect = {0.0f, 0.0f, static_cast<float>(rtColor.texture.width),
                               -static_cast<float>(rtColor.texture.height)};
    DrawTextureRec(rtColor.texture, srcRect, {0.0f, 0.0f}, WHITE);
    EndShaderMode();

    // Reset viewport to full screen for UI drawing
    rlViewport(0, 0, screenWidth, screenHeight);
    
    // Reset OpenGL state for 2D text rendering
    rlDisableDepthTest();
    rlSetTexture(0);

    const float margin = 20.0f;
    constexpr float brandFontSize = 32.0f;  // Larger, more readable
    const Vector2 textSize = MeasureTextEx(defaultFont, kBrandText, brandFontSize, 0.0f);
    const Vector2 brandPos = {
        static_cast<float>(screenWidth) - textSize.x - margin,
        margin};
    DrawTextEx(defaultFont, kBrandText, brandPos, brandFontSize, 0.0f, DARKGRAY);
    

    EndDrawing();
  };

#ifdef __EMSCRIPTEN__
  // Use Emscripten's main loop for web
  emscripten_set_main_loop_arg([](void* arg) {
    auto* loop = static_cast<decltype(mainLoop)*>(arg);
    (*loop)();
  }, &mainLoop, 0, 1);
  
  // Cleanup will be handled by browser - don't unload here
  return 0;
#else
  // Desktop main loop
  while (!WindowShouldClose()) {
    mainLoop();
  }

  UnloadRenderTexture(rtColor);
  UnloadRenderTexture(rtNormalDepth);
  UnloadMaterial(toonMat);
  UnloadMaterial(normalDepthMat);
  UnloadMaterial(outlineMat);   // also releases the shader
  UnloadShader(edgeShader);
  DestroyModel(model);
  JS_FreeRuntime(runtime);
  CloseWindow();

  return 0;
#endif
}

#include "raylib.h"
#include "raymath.h"
#include "rlgl.h"

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

namespace {
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

const char* kMatcapVS = R"glsl(
#version 330

in vec3 vertexPosition;
in vec3 vertexNormal;

uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matView;

out vec3 vNormalVS;

void main()
{
    mat3 normalMatrix = mat3(matView) * mat3(matModel);
    vNormalVS = normalize(normalMatrix * vertexNormal);
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

const char* kMatcapFS = R"glsl(
#version 330

in vec3 vNormalVS;
out vec4 finalColor;

uniform sampler2D texture0;
uniform vec4 fallbackColor;

void main()
{
    vec3 n = normalize(vNormalVS);
    vec2 uv = n.xy * 0.5 + 0.5;
    uv.y = 1.0 - uv.y;
    vec2 uvClamped = clamp(uv, vec2(0.0), vec2(1.0));
    vec4 matcap = texture(texture0, uvClamped);
    vec4 color = mix(fallbackColor, matcap, matcap.a);
    finalColor = vec4(color.rgb, 1.0);
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

struct MatcapEntry {
  Texture2D texture{};
  std::string name;
  std::filesystem::path path;
};

enum class ShadingMode {
  Smooth = 0,
  Flat = 1
};

struct ModelVariants {
  Model smooth{};
  Model flat{};
};

constexpr int kMatcapMenuMaxColumns = 4;
constexpr float kMatcapTileSize = 64.0f;
constexpr float kMatcapTileLabelHeight = 18.0f;
constexpr float kMatcapMenuPadding = 10.0f;
constexpr float kMatcapMenuHeaderHeight = 32.0f;
constexpr float kMatcapMenuButtonGap = 8.0f;
constexpr float kMatcapButtonWidth = 120.0f;
constexpr float kMatcapButtonHeight = 36.0f;
constexpr float kShadingButtonWidth = 140.0f;
constexpr float kShadingButtonHeight = 48.0f;

void UnloadMatcaps(std::vector<MatcapEntry> &matcaps) {
  for (auto &entry : matcaps) {
    if (entry.texture.id != 0) {
      UnloadTexture(entry.texture);
      entry.texture = Texture2D{};
    }
  }
}

Rectangle ComputeMatcapPopupRect(size_t itemCount,
                                 const Rectangle &buttonRect,
                                 int screenWidth,
                                 int screenHeight) {
  Rectangle popup{0.0f, 0.0f, 0.0f, 0.0f};
  if (itemCount == 0) {
    return popup;
  }

  const int columns = std::max(1, std::min(kMatcapMenuMaxColumns,
                                           static_cast<int>(itemCount)));
  const int rows = (static_cast<int>(itemCount) + columns - 1) / columns;
  const float cellHeight = kMatcapTileSize + kMatcapTileLabelHeight;
  const float width = columns * kMatcapTileSize + (columns + 1) * kMatcapMenuPadding;
  const float height = kMatcapMenuHeaderHeight +
                       rows * cellHeight + (rows + 1) * kMatcapMenuPadding;

  popup.width = width;
  popup.height = height;
  popup.x = buttonRect.x + buttonRect.width - width;
  popup.y = buttonRect.y + buttonRect.height + kMatcapMenuButtonGap;

  if (popup.x < kMatcapMenuPadding) {
    popup.x = kMatcapMenuPadding;
  }
  if (popup.y + popup.height > static_cast<float>(screenHeight) - kMatcapMenuPadding) {
    popup.y = std::max(kMatcapMenuPadding,
                       static_cast<float>(screenHeight) - popup.height - kMatcapMenuPadding);
  }

  return popup;
}

int MatcapIndexAtPosition(const Vector2 &point,
                          const Rectangle &popupRect,
                          size_t itemCount) {
  if (itemCount == 0) return -1;
  if (!CheckCollisionPointRec(point, popupRect)) return -1;

  float localX = point.x - popupRect.x - kMatcapMenuPadding;
  float localY = point.y - popupRect.y - kMatcapMenuPadding;
  if (localX < 0.0f || localY < kMatcapMenuHeaderHeight) {
    return -1;
  }
  localY -= kMatcapMenuHeaderHeight;
  if (localY < 0.0f) {
    return -1;
  }

  const int columns = std::max(1, std::min(kMatcapMenuMaxColumns,
                                           static_cast<int>(itemCount)));
  const float cellHeight = kMatcapTileSize + kMatcapTileLabelHeight;
  const float strideX = kMatcapTileSize + kMatcapMenuPadding;
  const float strideY = cellHeight + kMatcapMenuPadding;

  const int column = static_cast<int>(localX / strideX);
  const int row = static_cast<int>(localY / strideY);
  if (column < 0 || column >= columns || row < 0) {
    return -1;
  }

  const float withinX = localX - column * strideX;
  const float withinY = localY - row * strideY;
  if (withinX > kMatcapTileSize || withinY > cellHeight) {
    return -1;
  }

  const int index = row * columns + column;
  if (index >= static_cast<int>(itemCount)) {
    return -1;
  }
  return index;
}

std::vector<MatcapEntry> LoadMatcapsFromDir(const std::filesystem::path &directory) {
  std::vector<MatcapEntry> result;
  std::error_code ec;
  if (!std::filesystem::exists(directory, ec) ||
      !std::filesystem::is_directory(directory, ec)) {
    TraceLog(LOG_INFO, "Matcap directory not found: %s",
             directory.string().c_str());
    return result;
  }

  for (const auto &entry : std::filesystem::directory_iterator(directory, ec)) {
    if (ec) {
      TraceLog(LOG_WARNING, "Error iterating matcap directory: %s",
               ec.message().c_str());
      break;
    }
    if (!entry.is_regular_file(ec) || ec) {
      ec.clear();
      continue;
    }

    std::string ext = entry.path().extension().string();
    std::transform(ext.begin(), ext.end(), ext.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (ext != ".png" && ext != ".jpg" && ext != ".jpeg" &&
        ext != ".bmp" && ext != ".tga") {
      continue;
    }

    Texture2D texture = LoadTexture(entry.path().string().c_str());
    if (texture.id == 0) {
      TraceLog(LOG_WARNING, "Failed to load matcap texture: %s",
               entry.path().string().c_str());
      continue;
    }
    SetTextureFilter(texture, TEXTURE_FILTER_BILINEAR);

    MatcapEntry matcap;
    matcap.texture = texture;
    matcap.name = entry.path().stem().string();
    matcap.path = entry.path();
    result.push_back(std::move(matcap));
  }

  std::sort(result.begin(), result.end(),
            [](const MatcapEntry &a, const MatcapEntry &b) {
              return a.name < b.name;
            });

  return result;
}

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

void DestroyModelVariants(ModelVariants &variants) {
  DestroyModel(variants.smooth);
  DestroyModel(variants.flat);
}

Model CreateSmoothModelFrom(const manifold::MeshGL &meshGL) {
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

Model CreateFlatModelFrom(const manifold::MeshGL &meshGL) {
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
    const float cadX = meshGL.vertProperties[base + 0] * kSceneScale;
    const float cadY = meshGL.vertProperties[base + 1] * kSceneScale;
    const float cadZ = meshGL.vertProperties[base + 2] * kSceneScale;
    positions[v] = {cadX, cadZ, -cadY};
  }

  constexpr int kMaxVerticesPerMesh = std::numeric_limits<unsigned short>::max();
  const int maxTrianglesPerChunk = std::max(1, kMaxVerticesPerMesh / 3);

  std::vector<Mesh> meshes;
  meshes.reserve(static_cast<size_t>(triangleCount) / maxTrianglesPerChunk + 1);

  const Color base = kBaseColor;

  int triIndex = 0;
  while (triIndex < triangleCount) {
    const int remaining = triangleCount - triIndex;
    const int chunkTriangles = std::min(remaining, maxTrianglesPerChunk);
    const int chunkVertices = chunkTriangles * 3;

    Mesh chunk = {0};
    chunk.vertexCount = chunkVertices;
    chunk.triangleCount = chunkTriangles;
    chunk.vertices = static_cast<float *>(MemAlloc(chunkVertices * 3 * sizeof(float)));
    chunk.normals = static_cast<float *>(MemAlloc(chunkVertices * 3 * sizeof(float)));
    chunk.colors = static_cast<unsigned char *>(MemAlloc(chunkVertices * 4 * sizeof(unsigned char)));
    chunk.indices = static_cast<unsigned short *>(MemAlloc(chunkTriangles * 3 * sizeof(unsigned short)));
    chunk.texcoords = nullptr;
    chunk.texcoords2 = nullptr;
    chunk.tangents = nullptr;

    for (int t = 0; t < chunkTriangles; ++t) {
      const int globalTri = triIndex + t;
      const int i0 = meshGL.triVerts[globalTri * 3 + 0];
      const int i1 = meshGL.triVerts[globalTri * 3 + 1];
      const int i2 = meshGL.triVerts[globalTri * 3 + 2];

      const Vector3 p0 = positions[i0];
      const Vector3 p1 = positions[i1];
      const Vector3 p2 = positions[i2];

      const Vector3 u = {p1.x - p0.x, p1.y - p0.y, p1.z - p0.z};
      const Vector3 v = {p2.x - p0.x, p2.y - p0.y, p2.z - p0.z};
      Vector3 n = {u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z,
                   u.x * v.y - u.y * v.x};
      const float length = std::sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
      if (length > 0.0f) {
        const float invLen = 1.0f / length;
        n.x *= invLen;
        n.y *= invLen;
        n.z *= invLen;
      } else {
        n = {0.0f, 1.0f, 0.0f};
      }

      const int baseVertex = t * 3;
      const Vector3 triPositions[3] = {p0, p1, p2};
      for (int j = 0; j < 3; ++j) {
        const Vector3 pos = triPositions[j];
        const int dst = baseVertex + j;
        chunk.vertices[dst * 3 + 0] = pos.x;
        chunk.vertices[dst * 3 + 1] = pos.y;
        chunk.vertices[dst * 3 + 2] = pos.z;

        chunk.normals[dst * 3 + 0] = n.x;
        chunk.normals[dst * 3 + 1] = n.y;
        chunk.normals[dst * 3 + 2] = n.z;

        chunk.colors[dst * 4 + 0] = base.r;
        chunk.colors[dst * 4 + 1] = base.g;
        chunk.colors[dst * 4 + 2] = base.b;
        chunk.colors[dst * 4 + 3] = base.a;

        chunk.indices[dst] = static_cast<unsigned short>(dst);
      }
    }

    UploadMesh(&chunk, false);
    meshes.push_back(chunk);
    triIndex += chunkTriangles;
  }

  if (meshes.empty()) {
    return model;
  }

  model.transform = MatrixIdentity();
  model.meshCount = static_cast<int>(meshes.size());
  model.meshes = static_cast<Mesh *>(MemAlloc(model.meshCount * sizeof(Mesh)));
  for (int i = 0; i < model.meshCount; ++i) {
    model.meshes[i] = meshes[i];
  }
  model.materialCount = 1;
  model.materials = static_cast<Material *>(MemAlloc(sizeof(Material)));
  model.materials[0] = LoadMaterialDefault();
  model.meshMaterial = static_cast<int *>(MemAlloc(model.meshCount * sizeof(int)));
  for (int i = 0; i < model.meshCount; ++i) {
    model.meshMaterial[i] = 0;
  }

  return model;
}

ModelVariants CreateModelVariantsFrom(const manifold::MeshGL &meshGL) {
  ModelVariants variants;
  variants.smooth = CreateSmoothModelFrom(meshGL);
  variants.flat = CreateFlatModelFrom(meshGL);
  return variants;
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

bool ReplaceScene(ModelVariants &models,
                  const std::shared_ptr<manifold::Manifold> &scene) {
  if (!scene) return false;
  ModelVariants newModels = CreateModelVariantsFrom(scene->GetMeshGL());
  if (newModels.smooth.meshCount == 0 && newModels.flat.meshCount == 0) {
    return false;
  }
  DestroyModelVariants(models);
  models = newModels;
  return true;
}

}  // namespace

int main() {
  SetConfigFlags(FLAG_MSAA_4X_HINT | FLAG_WINDOW_RESIZABLE);
  InitWindow(1280, 720, "dingcad");
  SetTargetFPS(60);

  const std::filesystem::path matcapDirectory =
      std::filesystem::current_path() / "viewer/assets/matcaps";
  auto matcaps = LoadMatcapsFromDir(matcapDirectory);
  int currentMatcap = -1;
  bool showMatcapPopup = false;
  if (!matcaps.empty()) {
    TraceLog(LOG_INFO, "Loaded %zu matcap(s) from %s", matcaps.size(),
             matcapDirectory.string().c_str());
  }

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

  ModelVariants modelVariants = CreateModelVariantsFrom(scene->GetMeshGL());
  ShadingMode shadingMode = ShadingMode::Smooth;
  auto getActiveModel = [&]() -> Model & {
    Model *primary = (shadingMode == ShadingMode::Flat) ? &modelVariants.flat
                                                        : &modelVariants.smooth;
    if (primary->meshCount > 0) {
      return *primary;
    }
    Model *alternate = (primary == &modelVariants.flat) ? &modelVariants.smooth
                                                        : &modelVariants.flat;
    if (alternate->meshCount > 0) {
      return *alternate;
    }
    return *primary;
  };

  Shader outlineShader = LoadShaderFromMemory(kOutlineVS, kOutlineFS);
  Shader toonShader = LoadShaderFromMemory(kToonVS, kToonFS);
  Shader matcapShader = LoadShaderFromMemory(kMatcapVS, kMatcapFS);
  Shader normalDepthShader = LoadShaderFromMemory(kNormalDepthVS, kNormalDepthFS);
  Shader edgeShader = LoadShaderFromMemory(kEdgeQuadVS, kEdgeFS);

  if (outlineShader.id == 0 || toonShader.id == 0 || matcapShader.id == 0 ||
      normalDepthShader.id == 0 || edgeShader.id == 0) {
    TraceLog(LOG_ERROR, "Failed to load one or more shaders.");
    DestroyModelVariants(modelVariants);
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

  const int locMatcapFallbackColor = GetShaderLocation(matcapShader, "fallbackColor");
  Material matcapMat = LoadMaterialDefault();
  matcapMat.shader = matcapShader;
  matcapMat.maps[MATERIAL_MAP_DIFFUSE].texture = Texture2D{};
  matcapMat.maps[MATERIAL_MAP_DIFFUSE].color = WHITE;

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
  const float matcapFallback[4] = {
      kBaseColor.r / 255.0f,
      kBaseColor.g / 255.0f,
      kBaseColor.b / 255.0f,
      1.0f};
  SetShaderValue(matcapShader, locMatcapFallbackColor, matcapFallback, SHADER_UNIFORM_VEC4);
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

  while (!WindowShouldClose()) {
    const Vector2 mouseDelta = GetMouseDelta();
    const Vector2 mousePos = GetMousePosition();
    const int screenWidth = std::max(GetScreenWidth(), 1);
    const int screenHeight = std::max(GetScreenHeight(), 1);

    const float uiMargin = 20.0f;
    const Vector2 brandingSize = MeasureTextEx(brandingFont, kBrandText, kBrandFontSize, 0.0f);
    Rectangle matcapButtonRect = {
        static_cast<float>(screenWidth) - uiMargin - kMatcapButtonWidth,
        uiMargin + brandingSize.y + 12.0f,
        kMatcapButtonWidth,
        kMatcapButtonHeight};

    size_t matcapItemCount = matcaps.empty() ? 0 : matcaps.size() + 1;
    Rectangle matcapPopupRect = {0.0f, 0.0f, 0.0f, 0.0f};
    if (showMatcapPopup && matcapItemCount > 0) {
      matcapPopupRect = ComputeMatcapPopupRect(matcapItemCount, matcapButtonRect,
                                               screenWidth, screenHeight);
    }

    const bool matcapButtonHovered = !matcaps.empty() &&
                                     CheckCollisionPointRec(mousePos, matcapButtonRect);
    const bool matcapPopupHovered = showMatcapPopup && matcapItemCount > 0 &&
                                    CheckCollisionPointRec(mousePos, matcapPopupRect);
    bool uiBlockingMouse = false;

    if (matcaps.empty()) {
      showMatcapPopup = false;
    } else {
      uiBlockingMouse = matcapButtonHovered || (showMatcapPopup && matcapPopupHovered);
      if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        if (matcapButtonHovered) {
          showMatcapPopup = !showMatcapPopup;
        } else if (showMatcapPopup && matcapPopupHovered) {
          const int hitIndex = MatcapIndexAtPosition(mousePos, matcapPopupRect, matcapItemCount);
          if (hitIndex >= 0) {
            const int desired = (hitIndex == 0) ? -1 : static_cast<int>(hitIndex - 1);
            currentMatcap = desired;
            showMatcapPopup = false;
          }
        } else if (showMatcapPopup) {
          showMatcapPopup = false;
        }
      }
    }

    Rectangle shadingButtonRect = {
        matcapButtonRect.x,
        matcapButtonRect.y + matcapButtonRect.height + 8.0f,
        kShadingButtonWidth,
        kShadingButtonHeight};
    const bool shadingButtonHovered = CheckCollisionPointRec(mousePos, shadingButtonRect);
    uiBlockingMouse = uiBlockingMouse || shadingButtonHovered;

    if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT) && shadingButtonHovered) {
      if (shadingMode == ShadingMode::Smooth) {
        if (modelVariants.flat.meshCount > 0) {
          shadingMode = ShadingMode::Flat;
        }
      } else {
        shadingMode = ShadingMode::Smooth;
      }
    }

    auto reloadScene = [&]() {
      auto load = LoadSceneFromFile(runtime, scriptPath);
      if (load.success) {
        scene = load.manifold;
        ReplaceScene(modelVariants, scene);
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

    if (!uiBlockingMouse && IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
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

    if (!uiBlockingMouse && IsMouseButtonDown(MOUSE_BUTTON_RIGHT)) {
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

    if (shadingMode == ShadingMode::Flat && modelVariants.flat.meshCount == 0) {
      shadingMode = ShadingMode::Smooth;
    }

    Model &model = getActiveModel();

    Material *shadedMaterial = &toonMat;
    if (currentMatcap >= 0 && currentMatcap < static_cast<int>(matcaps.size())) {
      matcapMat.maps[MATERIAL_MAP_DIFFUSE].texture = matcaps[currentMatcap].texture;
      matcapMat.maps[MATERIAL_MAP_DIFFUSE].color = WHITE;
      shadedMaterial = &matcapMat;
    }

    BeginTextureMode(rtColor);
    ClearBackground(RAYWHITE);
    BeginMode3D(camera);
    DrawXZGrid(40, 0.5f, Fade(LIGHTGRAY, 0.4f));
    DrawAxes(2.0f);

    rlDisableBackfaceCulling();
    for (int i = 0; i < model.meshCount; ++i) {
      DrawMesh(model.meshes[i], outlineMat, model.transform);
    }
    rlEnableBackfaceCulling();

    for (int i = 0; i < model.meshCount; ++i) {
      DrawMesh(model.meshes[i], *shadedMaterial, model.transform);
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

    if (!matcaps.empty()) {
      Color buttonFill = matcapButtonHovered ? Fade(LIGHTGRAY, 0.6f) : Fade(LIGHTGRAY, 0.35f);
      Color buttonOutline = Fade(DARKGRAY, matcapButtonHovered ? 0.6f : 0.4f);
      DrawRectangleRounded(matcapButtonRect, 0.3f, 8, buttonFill);
      DrawRectangleRoundedLinesEx(matcapButtonRect, 0.3f, 8, 1.0f, buttonOutline);

      Rectangle previewRect = {
          matcapButtonRect.x + 6.0f,
          matcapButtonRect.y + 4.0f,
          matcapButtonRect.height - 8.0f,
          matcapButtonRect.height - 8.0f};

      if (currentMatcap >= 0 && currentMatcap < static_cast<int>(matcaps.size())) {
        const MatcapEntry &preview = matcaps[static_cast<size_t>(currentMatcap)];
        Rectangle src = {0.0f, 0.0f,
                         static_cast<float>(preview.texture.width),
                         static_cast<float>(preview.texture.height)};
        Rectangle dst = previewRect;
        Vector2 origin = {0.0f, 0.0f};
        DrawTexturePro(preview.texture, src, dst, origin, 0.0f, WHITE);
      } else {
        DrawRectangleRounded(previewRect, 0.5f, 8, Fade(DARKGRAY, 0.25f));
        DrawRectangleRoundedLinesEx(previewRect, 0.5f, 8, 1.0f, Fade(DARKGRAY, 0.45f));
        Vector2 lineStart = {previewRect.x + 5.0f, previewRect.y + previewRect.height / 2.0f};
        Vector2 lineEnd = {previewRect.x + previewRect.width - 5.0f,
                           previewRect.y + previewRect.height / 2.0f};
        DrawLineEx(lineStart, lineEnd, 2.0f, Fade(DARKGRAY, 0.45f));
      }

      const char *buttonLabel = showMatcapPopup ? "Matcap ^" : "Matcap v";
      const float buttonFontSize = 18.0f;
      Vector2 labelSize = MeasureTextEx(brandingFont, buttonLabel, buttonFontSize, 0.0f);
      Vector2 labelPos = {
          previewRect.x + previewRect.width + 8.0f,
          matcapButtonRect.y + (matcapButtonRect.height - labelSize.y) * 0.5f};
      DrawTextEx(brandingFont, buttonLabel, labelPos, buttonFontSize, 0.0f, DARKGRAY);

      if (showMatcapPopup && matcapItemCount > 0) {
        Color popupBg = Fade(RAYWHITE, 0.97f);
        Color popupOutline = Fade(DARKGRAY, 0.35f);
        DrawRectangleRounded(matcapPopupRect, 0.1f, 6, popupBg);
        DrawRectangleRoundedLinesEx(matcapPopupRect, 0.1f, 6, 1.0f, popupOutline);

        const char *popupTitle = "Matcaps";
        const float popupTitleSize = 20.0f;
        Vector2 titlePos = {
            matcapPopupRect.x + kMatcapMenuPadding,
            matcapPopupRect.y + 6.0f};
        DrawTextEx(brandingFont, popupTitle, titlePos, popupTitleSize, 0.0f, DARKGRAY);

        const int columns = std::max(1, std::min(kMatcapMenuMaxColumns,
                                                 static_cast<int>(matcapItemCount)));
        const float cellHeight = kMatcapTileSize + kMatcapTileLabelHeight;
        const int hoveredIndex = MatcapIndexAtPosition(mousePos, matcapPopupRect, matcapItemCount);
        const float labelFontSize = 16.0f;

        for (size_t idx = 0; idx < matcapItemCount; ++idx) {
          const int row = static_cast<int>(idx) / columns;
          const int col = static_cast<int>(idx) % columns;
          const float cellX = matcapPopupRect.x + kMatcapMenuPadding +
                              col * (kMatcapTileSize + kMatcapMenuPadding);
          const float cellY = matcapPopupRect.y + kMatcapMenuPadding +
                              kMatcapMenuHeaderHeight +
                              row * (cellHeight + kMatcapMenuPadding);

          Rectangle imageRect = {cellX, cellY, kMatcapTileSize, kMatcapTileSize};
          Rectangle labelRect = {cellX, cellY + kMatcapTileSize, kMatcapTileSize, kMatcapTileLabelHeight};

          const bool selected = (idx == 0 && currentMatcap < 0) ||
                                (idx > 0 && currentMatcap == static_cast<int>(idx - 1));
          const bool hovered = hoveredIndex == static_cast<int>(idx);
          Color tileColor = selected ? Fade(SKYBLUE, 0.35f) : Fade(LIGHTGRAY, 0.25f);
          if (hovered) tileColor = Fade(SKYBLUE, 0.45f);

          DrawRectangleRounded(imageRect, 0.2f, 6, tileColor);
          DrawRectangleRoundedLinesEx(imageRect, 0.2f, 6, 1.0f, Fade(DARKGRAY, 0.25f));

          std::string label = (idx == 0) ? "None" : std::to_string(idx);

          if (idx == 0) {
            Vector2 noneSize = MeasureTextEx(brandingFont, "None", labelFontSize, 0.0f);
            Vector2 nonePos = {
                imageRect.x + (imageRect.width - noneSize.x) * 0.5f,
                imageRect.y + (imageRect.height - noneSize.y) * 0.5f};
            DrawTextEx(brandingFont, "None", nonePos, labelFontSize, 0.0f, DARKGRAY);
          } else {
            const MatcapEntry &entry = matcaps[idx - 1];
            Rectangle src = {0.0f, 0.0f,
                             static_cast<float>(entry.texture.width),
                             static_cast<float>(entry.texture.height)};
            Rectangle dst = imageRect;
            Vector2 origin = {0.0f, 0.0f};
            DrawTexturePro(entry.texture, src, dst, origin, 0.0f, WHITE);
          }

          Vector2 labelSizeSmall = MeasureTextEx(brandingFont, label.c_str(), labelFontSize, 0.0f);
          Vector2 labelPosSmall = {
              labelRect.x + (labelRect.width - labelSizeSmall.x) * 0.5f,
              labelRect.y + (labelRect.height - labelSizeSmall.y) * 0.5f};
          DrawTextEx(brandingFont, label.c_str(), labelPosSmall, labelFontSize, 0.0f, DARKGRAY);
        }
      }
    }

    Color shadingFill = shadingButtonHovered ? Fade(LIGHTGRAY, 0.6f) : Fade(LIGHTGRAY, 0.35f);
    Color shadingOutline = Fade(DARKGRAY, shadingButtonHovered ? 0.6f : 0.4f);
    DrawRectangleRounded(shadingButtonRect, 0.3f, 8, shadingFill);
    DrawRectangleRoundedLinesEx(shadingButtonRect, 0.3f, 8, 1.0f, shadingOutline);

    const char *shadingTitle = "Shading";
    const float shadingTitleSize = 16.0f;
    Vector2 shadingTitleSizeVec = MeasureTextEx(brandingFont, shadingTitle, shadingTitleSize, 0.0f);
    Vector2 shadingTitlePos = {
        shadingButtonRect.x + 12.0f,
        shadingButtonRect.y + 6.0f};
    DrawTextEx(brandingFont, shadingTitle, shadingTitlePos, shadingTitleSize, 0.0f, DARKGRAY);

    const char *shadingState =
        (shadingMode == ShadingMode::Smooth) ? "Smooth" : "Flat";
    const float shadingStateSize = 20.0f;
    Vector2 shadingStateSizeVec = MeasureTextEx(brandingFont, shadingState, shadingStateSize, 0.0f);
    Vector2 shadingStatePos = {
        shadingButtonRect.x + (shadingButtonRect.width - shadingStateSizeVec.x) * 0.5f,
        shadingButtonRect.y + shadingButtonRect.height - shadingStateSizeVec.y - 8.0f};
    DrawTextEx(brandingFont, shadingState, shadingStatePos, shadingStateSize, 0.0f,
               shadingMode == ShadingMode::Smooth ? DARKGRAY : Fade(DARKBLUE, 0.9f));

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

  UnloadRenderTexture(rtColor);
  UnloadRenderTexture(rtNormalDepth);
  matcapMat.maps[MATERIAL_MAP_DIFFUSE].texture = Texture2D{};
  UnloadMaterial(matcapMat);
  UnloadMaterial(toonMat);
  UnloadMaterial(normalDepthMat);
  UnloadMaterial(outlineMat);   // also releases the shader
  UnloadShader(edgeShader);
  UnloadMatcaps(matcaps);
  DestroyModelVariants(modelVariants);
  if (brandingFontCustom) {
    UnloadFont(brandingFont);
  }
  JS_FreeRuntime(runtime);
  CloseWindow();

  return 0;
}

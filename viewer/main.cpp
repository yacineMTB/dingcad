#include "raylib.h"
#include "raymath.h"

#include <array>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <memory>
#include <optional>
#include <sstream>
#include <string>
#include <system_error>
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

void DestroyMeshAndModel(Model &model, Mesh &mesh) {
  if (model.meshes != nullptr || model.materials != nullptr) {
    UnloadModel(model);
  }
  mesh = Mesh{};
  model = Model{};
}

Mesh CreateRaylibMeshFrom(const manifold::MeshGL &meshGL) {
  Mesh mesh = {0};
  const int vertexCount = meshGL.NumVert();
  const int triangleCount = meshGL.NumTri();

  mesh.vertexCount = vertexCount;
  mesh.triangleCount = triangleCount;
  mesh.vertices = static_cast<float *>(MemAlloc(vertexCount * 3 * sizeof(float)));
  mesh.normals = static_cast<float *>(MemAlloc(vertexCount * 3 * sizeof(float)));
  mesh.indices = static_cast<unsigned short *>(
      MemAlloc(triangleCount * 3 * sizeof(unsigned short)));
  mesh.colors = static_cast<unsigned char *>(
      MemAlloc(vertexCount * 4 * sizeof(unsigned char)));
  mesh.texcoords = nullptr;
  mesh.texcoords2 = nullptr;
  mesh.tangents = nullptr;

  const int stride = meshGL.numProp;
  for (int v = 0; v < vertexCount; ++v) {
    const int base = v * stride;
    mesh.vertices[v * 3 + 0] = meshGL.vertProperties[base + 0];
    mesh.vertices[v * 3 + 1] = meshGL.vertProperties[base + 1];
    mesh.vertices[v * 3 + 2] = meshGL.vertProperties[base + 2];
    mesh.normals[v * 3 + 0] = 0.0f;
    mesh.normals[v * 3 + 1] = 0.0f;
    mesh.normals[v * 3 + 2] = 0.0f;
  }

  for (int i = 0; i < triangleCount * 3; ++i) {
    mesh.indices[i] = static_cast<unsigned short>(meshGL.triVerts[i]);
  }

  std::vector<Vector3> accum(vertexCount);
  for (int tri = 0; tri < triangleCount; ++tri) {
    const int i0 = mesh.indices[tri * 3 + 0];
    const int i1 = mesh.indices[tri * 3 + 1];
    const int i2 = mesh.indices[tri * 3 + 2];

    const Vector3 p0 = {mesh.vertices[i0 * 3 + 0], mesh.vertices[i0 * 3 + 1],
                        mesh.vertices[i0 * 3 + 2]};
    const Vector3 p1 = {mesh.vertices[i1 * 3 + 0], mesh.vertices[i1 * 3 + 1],
                        mesh.vertices[i1 * 3 + 2]};
    const Vector3 p2 = {mesh.vertices[i2 * 3 + 0], mesh.vertices[i2 * 3 + 1],
                        mesh.vertices[i2 * 3 + 2]};

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

  for (int v = 0; v < vertexCount; ++v) {
    const Vector3 n = accum[v];
    const float length = std::sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
    if (length > 0.0f) {
      mesh.normals[v * 3 + 0] = n.x / length;
      mesh.normals[v * 3 + 1] = n.y / length;
      mesh.normals[v * 3 + 2] = n.z / length;
    } else {
      mesh.normals[v * 3 + 0] = 0.0f;
      mesh.normals[v * 3 + 1] = 1.0f;
      mesh.normals[v * 3 + 2] = 0.0f;
    }

    const Vector3 normal = {mesh.normals[v * 3 + 0], mesh.normals[v * 3 + 1],
                            mesh.normals[v * 3 + 2]};
    const Vector3 lightDir = Vector3Normalize({0.45f, 0.85f, 0.35f});
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
    mesh.colors[v * 4 + 0] = static_cast<unsigned char>(
        Clamp(base.r * finalIntensity, 0.0f, 255.0f));
    mesh.colors[v * 4 + 1] = static_cast<unsigned char>(
        Clamp(base.g * finalIntensity, 0.0f, 255.0f));
    mesh.colors[v * 4 + 2] = static_cast<unsigned char>(
        Clamp(base.b * finalIntensity, 0.0f, 255.0f));
    mesh.colors[v * 4 + 3] = base.a;
  }

  UploadMesh(&mesh, false);
  return mesh;
}

void DrawAxes(float length) {
  const Vector3 origin = {0.0f, 0.0f, 0.0f};
  DrawLine3D(origin, {length, 0.0f, 0.0f}, RED);
  DrawLine3D(origin, {0.0f, length, 0.0f}, GREEN);
  DrawLine3D(origin, {0.0f, 0.0f, length}, BLUE);
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

struct LoadResult {
  bool success = false;
  std::shared_ptr<manifold::Manifold> manifold;
  std::string message;
};

LoadResult LoadSceneFromFile(JSRuntime *runtime, const std::filesystem::path &path) {
  LoadResult result;
  if (!std::filesystem::exists(path)) {
    result.message = "Scene file not found: " + path.string();
    return result;
  }
  auto sourceOpt = ReadTextFile(path);
  if (!sourceOpt) {
    result.message = "Unable to read scene file: " + path.string();
    return result;
  }
  JSContext *ctx = JS_NewContext(runtime);
  RegisterBindings(ctx);
  JSValue evalResult = JS_Eval(ctx, sourceOpt->c_str(), sourceOpt->size(), path.string().c_str(), JS_EVAL_TYPE_GLOBAL);
  if (JS_IsException(evalResult)) {
    JSValue exc = JS_GetException(ctx);
    JSValue stack = JS_GetPropertyStr(ctx, exc, "stack");
    const char *stackStr = JS_ToCString(ctx, JS_IsUndefined(stack) ? exc : stack);
    result.message = stackStr ? stackStr : "JavaScript error";
    JS_FreeCString(ctx, stackStr);
    JS_FreeValue(ctx, stack);
    JS_FreeValue(ctx, exc);
    JS_FreeValue(ctx, evalResult);
    JS_FreeContext(ctx);
    return result;
  }
  JS_FreeValue(ctx, evalResult);

  JSValue global = JS_GetGlobalObject(ctx);
  JSValue sceneVal = JS_GetPropertyStr(ctx, global, "scene");
  JS_FreeValue(ctx, global);
  if (JS_IsUndefined(sceneVal)) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeContext(ctx);
    result.message = "Scene script must assign global 'scene'";
    return result;
  }
  auto sceneHandle = GetManifoldHandle(ctx, sceneVal);
  if (!sceneHandle) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeContext(ctx);
    result.message = "Global 'scene' is not a manifold";
    return result;
  }
  result.manifold = sceneHandle;
  result.success = true;
  result.message = "Loaded " + path.string();
  JS_FreeValue(ctx, sceneVal);
  JS_FreeContext(ctx);
  return result;
}

bool ReplaceScene(Model &model, Mesh &mesh,
                  const std::shared_ptr<manifold::Manifold> &scene) {
  if (!scene) return false;
  manifold::MeshGL meshGL = scene->GetMeshGL();
  Mesh newMesh = CreateRaylibMeshFrom(meshGL);
  Model newModel = LoadModelFromMesh(newMesh);
  DestroyMeshAndModel(model, mesh);
  mesh = newMesh;
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

  std::shared_ptr<manifold::Manifold> scene = nullptr;
  std::string statusMessage;
  std::filesystem::path scriptPath;
  std::optional<std::filesystem::file_time_type> scriptTimestamp;
  auto defaultScript = FindDefaultScene();
  auto reportStatus = [&](const std::string &message) {
    statusMessage = message;
    TraceLog(LOG_INFO, "%s", statusMessage.c_str());
  };
  if (defaultScript) {
    scriptPath = *defaultScript;
    auto load = LoadSceneFromFile(runtime, scriptPath);
    if (load.success) {
      scene = load.manifold;
      reportStatus(load.message);
    } else {
      reportStatus(load.message);
    }
    std::error_code ec;
    auto ts = std::filesystem::last_write_time(scriptPath, ec);
    if (!ec) scriptTimestamp = ts;
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

  Mesh mesh = CreateRaylibMeshFrom(scene->GetMeshGL());
  Model model = LoadModelFromMesh(mesh);

  while (!WindowShouldClose()) {
    const Vector2 mouseDelta = GetMouseDelta();

    auto reloadScene = [&](bool updateTimestamp) {
      auto load = LoadSceneFromFile(runtime, scriptPath);
      if (load.success) {
        scene = load.manifold;
        ReplaceScene(model, mesh, scene);
        reportStatus(load.message);
      } else {
        reportStatus(load.message);
      }
      if (updateTimestamp) {
        std::error_code ec;
        auto ts = std::filesystem::last_write_time(scriptPath, ec);
        if (!ec) scriptTimestamp = ts;
      }
    };

    if (!scriptPath.empty()) {
      std::error_code ec;
      auto currentTs = std::filesystem::last_write_time(scriptPath, ec);
      if (!ec) {
        if (!scriptTimestamp || currentTs != *scriptTimestamp) {
          reloadScene(false);
          scriptTimestamp = currentTs;
        }
      }
    }

    if (IsKeyPressed(KEY_R) && !scriptPath.empty()) {
      reloadScene(true);
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
    DrawXZGrid(12, 0.5f, Fade(LIGHTGRAY, 0.4f));
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

    EndDrawing();
  }

  DestroyMeshAndModel(model, mesh);
  if (brandingFontCustom) {
    UnloadFont(brandingFont);
  }
  JS_FreeRuntime(runtime);
  CloseWindow();

  return 0;
}

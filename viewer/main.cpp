#include "raylib.h"
#include "raymath.h"
#include "rlgl.h"

#ifdef __APPLE__
#include <OpenGL/gl3.h>
#include <ApplicationServices/ApplicationServices.h>
#endif

#include <atomic>
#include <algorithm>
#include <cfloat>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <future>
#include <iostream>
#include <mutex>
#include <set>
#include <thread>
#include <unordered_map>
#include <vector>

extern "C" {
#include "quickjs.h"
}

#include "manifold/manifold.h"
#include "js_bindings.h"

#include "shaders.h"
#include "types.h"
#include "file_utils.h"
#include "mesh_utils.h"
#include "scene_loader.h"
#include "material_loader.h"
#include "ui_panels.h"
#include "thermal.h"
#include "structural.h"
#include "ifc_export.h"
#include "blueprint_export.h"
#include "assembly.h"

using namespace helscoop;

static void ExpandBounds(BoundingBox& dst, const BoundingBox& src, bool& hasAny) {
  if (!hasAny) {
    dst = src;
    hasAny = true;
    return;
  }
  dst.min.x = std::min(dst.min.x, src.min.x);
  dst.min.y = std::min(dst.min.y, src.min.y);
  dst.min.z = std::min(dst.min.z, src.min.z);
  dst.max.x = std::max(dst.max.x, src.max.x);
  dst.max.y = std::max(dst.max.y, src.max.y);
  dst.max.z = std::max(dst.max.z, src.max.z);
}

static std::filesystem::path GetDownloadsDir() {
  if (const char* home = std::getenv("HOME")) {
    return std::filesystem::path(home) / "Downloads";
  }
  return std::filesystem::current_path();
}

static BoundingBox ComputeSceneBounds(const std::vector<ModelWithColor>& models) {
  BoundingBox bounds = {{0.0f, 0.0f, 0.0f}, {0.0f, 0.0f, 0.0f}};
  bool hasAny = false;
  for (const auto& m : models) {
    BoundingBox bbox = GetModelBoundingBox(m.model);
    ExpandBounds(bounds, bbox, hasAny);
  }
  if (!hasAny) {
    bounds = {{-1.0f, -1.0f, -1.0f}, {1.0f, 1.0f, 1.0f}};
  }
  return bounds;
}

int main(int argc, char *argv[]) {
  // Parse command-line arguments
  bool renderMode = false;
  std::string renderScenePath;
  std::string renderOutputPath;
  int renderWidth = 1024;
  int renderHeight = 768;
  float camYaw = 40.0f * DEG2RAD;
  float camPitch = 23.0f * DEG2RAD;
  float camDist = 0.0f;     // 0 = auto-calculate based on scene
  float camDistScale = 1.0f; // Multiplier applied to auto distance
  float camTargetX = 0.0f, camTargetY = 0.0f, camTargetZ = 0.0f;
  bool camTargetSet = false;
  float camPosX = 0.0f, camPosY = 0.0f, camPosZ = 0.0f;
  bool camPosSet = false;
  float camTargetOffsetX = 0.0f, camTargetOffsetY = 0.0f, camTargetOffsetZ = 0.0f;
  bool camTargetOffsetSet = false;
  float renderFov = 45.0f;
  bool renderShowUI = false;
  int renderCaptureFrame = 3;
  std::set<std::string> renderHiddenMaterials;
  std::set<std::string> renderHiddenCategories;
  std::set<std::string> renderHiddenObjects;
  std::set<std::string> renderShowObjects;
  std::set<std::string> renderFocusMaterials;
  std::set<std::string> renderFocusObjects;
  std::set<std::string> renderFocusCategories;
  bool renderWhiteBackground = false;
  bool renderTransparentBg = false;
  int renderSupersample = 1;
  int turntableFrames = 0;
  bool renderWireframe = false;
  std::vector<std::pair<std::string, float>> cliParamOverrides;

  for (int i = 1; i < argc; i++) {
    std::string arg = argv[i];
    if (arg == "--help" || arg == "-h") {
      std::cout << "Usage: helscoop_viewer [scene.js] [options]\n"
                << "       helscoop_viewer --render scene.js output.png [options]\n\n"
                << "Render options:\n"
                << "  --render SCENE OUTPUT   Headless render to PNG\n"
                << "  --size W H              Output dimensions (default: 1280 720)\n"
                << "  --supersample N         Supersampling factor 1-4 (default: 1)\n"
                << "  --background MODE       white | transparent (default: sky gradient)\n"
                << "  --wireframe             Render in wireframe mode\n"
                << "  --toon                  Use toon shading instead of PBR\n"
                << "  --turntable N           Render N-frame turntable sequence\n"
                << "  --frames N              Capture at frame N (default: 1)\n"
                << "  --show-ui / --hide-ui   Show/hide UI in render output\n\n"
                << "Camera:\n"
                << "  --camera PRESET         front|back|left|right|top|bottom|iso|three-quarter\n"
                << "  --yaw DEG               Camera yaw in degrees\n"
                << "  --pitch DEG             Camera pitch in degrees\n"
                << "  --dist D                Camera distance (absolute)\n"
                << "  --dist-scale S          Camera distance multiplier\n"
                << "  --fov DEG               Field of view (default: 45)\n"
                << "  --target X Y Z          Camera look-at point\n"
                << "  --camera-pos X Y Z      Camera position (absolute)\n"
                << "  --target-offset X Y Z   Offset from auto-computed target\n\n"
                << "Filtering:\n"
                << "  --hide-material NAME    Hide objects with material\n"
                << "  --hide-category NAME    Hide objects in category\n"
                << "  --hide-object NAME      Hide specific object\n"
                << "  --show-object NAME      Show only specific object\n"
                << "  --focus-material NAME   Highlight material\n"
                << "  --focus-object NAME     Highlight object\n"
                << "  --focus-category NAME   Highlight category\n"
                << "  --interior-cutaway      Hide sheathing/roofing/cladding\n\n"
                << "Parameters:\n"
                << "  --param name=value      Override scene parameter value\n\n"
                << "Interactive:\n"
                << "  R         Reload scene\n"
                << "  T         Toggle parameters panel\n"
                << "  M         Toggle materials panel\n"
                << "  F         Toggle fullscreen\n"
                << "  1-4       Debug views (normal/depth/SSAO)\n"
                << "  Scroll    Zoom\n"
                << "  Drag      Orbit camera\n";
      return 0;
    } else if (arg == "--render" && i + 2 < argc) {
      renderMode = true;
      renderScenePath = argv[i + 1];
      renderOutputPath = argv[i + 2];
      i += 2;
    } else if (arg == "--size" && i + 2 < argc) {
      renderWidth = std::atoi(argv[i + 1]);
      renderHeight = std::atoi(argv[i + 2]);
      i += 2;
    } else if (arg == "--yaw" && i + 1 < argc) {
      camYaw = std::atof(argv[i + 1]) * DEG2RAD;
      i += 1;
    } else if (arg == "--pitch" && i + 1 < argc) {
      camPitch = std::atof(argv[i + 1]) * DEG2RAD;
      i += 1;
    } else if (arg == "--dist" && i + 1 < argc) {
      camDist = std::atof(argv[i + 1]);
      i += 1;
    } else if (arg == "--dist-scale" && i + 1 < argc) {
      camDistScale = std::atof(argv[i + 1]);
      i += 1;
    } else if (arg == "--target" && i + 3 < argc) {
      camTargetX = std::atof(argv[i + 1]);
      camTargetY = std::atof(argv[i + 2]);
      camTargetZ = std::atof(argv[i + 3]);
      camTargetSet = true;
      i += 3;
    } else if ((arg == "--camera-pos" || arg == "--cam-pos") && i + 3 < argc) {
      camPosX = std::atof(argv[i + 1]);
      camPosY = std::atof(argv[i + 2]);
      camPosZ = std::atof(argv[i + 3]);
      camPosSet = true;
      i += 3;
    } else if ((arg == "--look-at" || arg == "--cam-look") && i + 3 < argc) {
      camTargetX = std::atof(argv[i + 1]);
      camTargetY = std::atof(argv[i + 2]);
      camTargetZ = std::atof(argv[i + 3]);
      camTargetSet = true;
      i += 3;
    } else if (arg == "--target-offset" && i + 3 < argc) {
      camTargetOffsetX = std::atof(argv[i + 1]);
      camTargetOffsetY = std::atof(argv[i + 2]);
      camTargetOffsetZ = std::atof(argv[i + 3]);
      camTargetOffsetSet = true;
      i += 3;
    } else if (arg == "--fov" && i + 1 < argc) {
      renderFov = std::atof(argv[i + 1]);
      i += 1;
    } else if (arg == "--show-ui") {
      renderShowUI = true;
    } else if (arg == "--hide-ui") {
      renderShowUI = false;
    } else if (arg == "--frames" && i + 1 < argc) {
      renderCaptureFrame = std::atoi(argv[i + 1]);
      i += 1;
    } else if (arg == "--hide-material" && i + 1 < argc) {
      renderHiddenMaterials.insert(argv[i + 1]);
      i += 1;
    } else if (arg == "--hide-category" && i + 1 < argc) {
      renderHiddenCategories.insert(argv[i + 1]);
      i += 1;
    } else if (arg == "--hide-object" && i + 1 < argc) {
      renderHiddenObjects.insert(argv[i + 1]);
      i += 1;
    } else if (arg == "--show-object" && i + 1 < argc) {
      renderShowObjects.insert(argv[i + 1]);
      i += 1;
    } else if (arg == "--focus-material" && i + 1 < argc) {
      renderFocusMaterials.insert(argv[i + 1]);
      i += 1;
    } else if (arg == "--focus-object" && i + 1 < argc) {
      renderFocusObjects.insert(argv[i + 1]);
      i += 1;
    } else if (arg == "--focus-category" && i + 1 < argc) {
      renderFocusCategories.insert(argv[i + 1]);
      i += 1;
    } else if (arg == "--toon") {
      // Set toon rendering for headless render (handled after shader init)
    } else if (arg == "--background" && i + 1 < argc) {
      std::string bg = argv[i + 1];
      if (bg == "white" || bg == "clean") renderWhiteBackground = true;
      else if (bg == "transparent" || bg == "alpha") renderTransparentBg = true;
      i += 1;
    } else if (arg == "--supersample" && i + 1 < argc) {
      renderSupersample = std::clamp(std::atoi(argv[i + 1]), 1, 4);
      i += 1;
    } else if (arg == "--wireframe") {
      renderWireframe = true;
    } else if (arg == "--turntable" && i + 1 < argc) {
      turntableFrames = std::clamp(std::atoi(argv[i + 1]), 2, 360);
      i += 1;
    } else if (arg == "--camera" && i + 1 < argc) {
      std::string preset = argv[i + 1];
      if (preset == "front") {
        camYaw = 0.0f; camPitch = 0.0f;
      } else if (preset == "back") {
        camYaw = 180.0f * DEG2RAD; camPitch = 0.0f;
      } else if (preset == "left") {
        camYaw = -90.0f * DEG2RAD; camPitch = 0.0f;
      } else if (preset == "right") {
        camYaw = 90.0f * DEG2RAD; camPitch = 0.0f;
      } else if (preset == "top") {
        camYaw = 0.0f; camPitch = 89.0f * DEG2RAD;
      } else if (preset == "bottom") {
        camYaw = 0.0f; camPitch = -89.0f * DEG2RAD;
      } else if (preset == "iso") {
        camYaw = 45.0f * DEG2RAD; camPitch = 35.26f * DEG2RAD;
      } else if (preset == "iso-back") {
        camYaw = 135.0f * DEG2RAD; camPitch = 35.26f * DEG2RAD;
      } else if (preset == "three-quarter") {
        camYaw = 40.0f * DEG2RAD; camPitch = 23.0f * DEG2RAD;
      } else {
        std::cerr << "Unknown camera preset: " << preset
                  << " (use front/back/left/right/top/bottom/iso/iso-back/three-quarter)" << std::endl;
      }
      i += 1;
    } else if (arg == "--interior-cutaway") {
      renderHiddenCategories.insert("sheathing");
      renderHiddenCategories.insert("roofing");
      renderHiddenCategories.insert("finish");
      renderHiddenCategories.insert("cladding");
      renderHiddenMaterials.insert("hardware_cloth");
      renderHiddenMaterials.insert("insulation_100mm");
      renderHiddenMaterials.insert("vapor_barrier");
    } else if (arg == "--param" && i + 1 < argc) {
      std::string paramSpec = argv[i + 1];
      auto eqPos = paramSpec.find('=');
      if (eqPos != std::string::npos) {
        std::string name = paramSpec.substr(0, eqPos);
        float value = std::atof(paramSpec.substr(eqPos + 1).c_str());
        cliParamOverrides.push_back({name, value});
      } else {
        std::cerr << "Invalid --param format: " << paramSpec << " (use --param name=value)" << std::endl;
      }
      i += 1;
    }
  }

  // Resolve scene path: if relative and not found in CWD, try relative to
  // the binary's parent directories (handles running from build/).
  if (renderMode && !renderScenePath.empty()) {
    std::filesystem::path scenePath(renderScenePath);
    if (scenePath.is_relative() && !std::filesystem::exists(scenePath)) {
      std::filesystem::path binDir = std::filesystem::canonical(
          std::filesystem::path(argv[0]).parent_path());
      for (auto dir = binDir; dir.has_parent_path() && dir != dir.parent_path();
           dir = dir.parent_path()) {
        auto candidate = dir / scenePath;
        if (std::filesystem::exists(candidate)) {
          renderScenePath = candidate.string();
          break;
        }
      }
    }
  }

#ifdef __APPLE__
  if (renderMode) {
    system("caffeinate -u -t 15 &");
  }
  {
    uint32_t displayCount = 0;
    CGGetOnlineDisplayList(0, nullptr, &displayCount);
    if (displayCount == 0) {
      std::cerr << "No active macOS display session detected." << std::endl;
      std::cerr << "Run from a logged-in desktop session (GUI terminal, not SSH)." << std::endl;
      return 2;
    }
    // Check for WindowServer access by attempting to create a session dictionary.
    // CGGetOnlineDisplayList succeeds even in some sessions where GLFW can't
    // create windows (e.g., CLI tools without proper WindowServer access).
    CFDictionaryRef sessionDict = CGSessionCopyCurrentDictionary();
    if (sessionDict == nullptr) {
      std::cerr << "No window server session available. Run from a GUI terminal." << std::endl;
      return 2;
    }
    CFRelease(sessionDict);
  }
#endif

  const bool headlessRender = renderMode && !renderShowUI;
  unsigned int windowFlags = FLAG_MSAA_4X_HINT;
  if (!headlessRender) {
    windowFlags |= FLAG_WINDOW_RESIZABLE;
  }
  if (headlessRender) {
    windowFlags |= FLAG_WINDOW_HIDDEN;
  }

  SetConfigFlags(windowFlags);
  TraceLog(LOG_INFO, "Window init start: renderMode=%d headlessRender=%d", renderMode ? 1 : 0, headlessRender ? 1 : 0);
  const int ssWidth = renderWidth * renderSupersample;
  const int ssHeight = renderHeight * renderSupersample;
  if (renderMode) {
    InitWindow(ssWidth, ssHeight, "helscoop");
  } else {
    InitWindow(1280, 720, "helscoop");
  }
  TraceLog(LOG_INFO, "Window init complete");
  SetTargetFPS(60);

  Font brandingFont = GetFontDefault();
  Font uiFont = GetFontDefault();
  bool brandingFontCustom = false;
  bool uiFontCustom = false;

  bool skipCustomFonts = headlessRender;
  if (const char *skipFontsEnv = std::getenv("HELSCOOP_SKIP_CUSTOM_FONTS")) {
    skipCustomFonts = (std::string(skipFontsEnv) == "1");
  }

  if (!skipCustomFonts) {
    const std::filesystem::path berkeleyPath("BerkeleyMonoTrial-Regular.otf");
    const std::filesystem::path consolasPath("/System/Library/Fonts/Supplemental/Consolas.ttf");
    if (std::filesystem::exists(berkeleyPath)) {
      brandingFont = LoadFontEx(berkeleyPath.string().c_str(), static_cast<int>(kBrandFontSize), nullptr, 0);
      uiFont = LoadFontEx(berkeleyPath.string().c_str(), kUIFontSize, nullptr, 0);
      brandingFontCustom = true;
      uiFontCustom = true;
      TraceLog(LOG_INFO, "Loaded Berkeley Mono font");
    } else if (std::filesystem::exists(consolasPath)) {
      brandingFont = LoadFontEx(consolasPath.string().c_str(), static_cast<int>(kBrandFontSize), nullptr, 0);
      uiFont = LoadFontEx(consolasPath.string().c_str(), kUIFontSize, nullptr, 0);
      brandingFontCustom = true;
      uiFontCustom = true;
      TraceLog(LOG_INFO, "Loaded Consolas font (Berkeley Mono not found)");
    }
  } else {
    TraceLog(LOG_INFO, "Skipping custom fonts for render pipeline stability");
  }

  Camera3D camera = {0};
  camera.position = {4.0f, 4.0f, 4.0f};
  camera.target = {0.0f, 0.5f, 0.0f};
  camera.up = {0.0f, 1.0f, 0.0f};
  camera.fovy = renderFov;
  camera.projection = CAMERA_PERSPECTIVE;

  float orbitDistance = std::max(Vector3Distance(camera.position, camera.target), 0.001f);
  float orbitYaw = atan2f(camera.position.x - camera.target.x,
                          camera.position.z - camera.target.z);
  float orbitPitch = asinf(Clamp((camera.position.y - camera.target.y) / orbitDistance, -1.0f, 1.0f));
  const Vector3 initialTarget = camera.target;
  const float initialDistance = orbitDistance;
  const float initialYaw = orbitYaw;
  const float initialPitch = orbitPitch;

  JSRuntime *runtime = JS_NewRuntime();
  EnsureManifoldClass(runtime);
  JS_SetModuleLoaderFunc(runtime, nullptr, FilesystemModuleLoader, &g_moduleLoaderData);

  // Load material library relative to scene location in render mode.
  // Fall back to repository root/current cwd when scene-local materials are absent.
  bool materialLibraryLoaded = false;
  std::vector<std::filesystem::path> materialBaseCandidates;
  if (renderMode && !renderScenePath.empty()) {
    const std::filesystem::path sceneDir =
      std::filesystem::absolute(std::filesystem::path(renderScenePath)).parent_path();
    materialBaseCandidates.push_back(sceneDir);
    if (sceneDir.has_parent_path()) {
      materialBaseCandidates.push_back(sceneDir.parent_path());
      if (sceneDir.parent_path().has_parent_path()) {
        materialBaseCandidates.push_back(sceneDir.parent_path().parent_path());
      }
    }
  }
  materialBaseCandidates.push_back(std::filesystem::current_path());

  std::set<std::filesystem::path> triedBases;
  for (const auto& base : materialBaseCandidates) {
    const auto canonicalBase = std::filesystem::weakly_canonical(base);
    if (triedBases.find(canonicalBase) != triedBases.end()) {
      continue;
    }
    triedBases.insert(canonicalBase);
    if (InitMaterialLibrary(canonicalBase)) {
      materialLibraryLoaded = true;
      TraceLog(LOG_INFO, "Material library loaded from base: %s", canonicalBase.string().c_str());
      break;
    }
  }
  if (!materialLibraryLoaded) {
    TraceLog(LOG_WARNING, "Proceeding without material library; fallback colors only.");
  }

  SceneData sceneData;
  std::string statusMessage;
  std::string brandText = kBrandText;
  std::filesystem::path scriptPath;
  std::unordered_map<std::filesystem::path, WatchedFile> watchedFiles;
  std::optional<std::filesystem::path> defaultScript;

  if (renderMode && !renderScenePath.empty()) {
    defaultScript = std::filesystem::path(renderScenePath);
  } else {
    defaultScript = FindDefaultScene();
  }

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

  std::vector<MaterialItem> initialMaterials;
  AssemblyInstructions initialAssembly;
  double currentDisplayScale = 1.0;
  if (defaultScript) {
    scriptPath = std::filesystem::absolute(*defaultScript);
    auto load = LoadSceneFromFile(runtime, scriptPath);
    if (load.success) {
      sceneData = load.sceneData;
      initialMaterials = std::move(load.materials);
      initialAssembly = std::move(load.assembly);
      currentDisplayScale = load.displayScale;
      reportStatus(load.message);
    } else {
      reportStatus(load.message);
    }
    if (!load.dependencies.empty()) {
      setWatchedFiles(load.dependencies);
    }
    // Derive brand text from script path: use parent dir name if file is main.js
    std::string stem = scriptPath.stem().string();
    if (stem == "main" || stem == "scene" || stem == "index") {
      stem = scriptPath.parent_path().filename().string();
    }
    brandText = toUpper(stem);
  }

  if (sceneData.objects.empty()) {
    manifold::Manifold cube = manifold::Manifold::Cube({2.0, 2.0, 2.0}, true);
    manifold::Manifold sphere = manifold::Manifold::Sphere(1.2, 0);
    manifold::Manifold combo = cube + sphere.Translate({0.0, 0.8, 0.0});
    sceneData.objects.push_back({
      std::make_shared<manifold::Manifold>(combo),
      kBaseColor
    });
    if (statusMessage.empty()) {
      reportStatus("No scene.js found. Using built-in sample.");
    }
  }

  std::vector<ModelWithColor> models = CreateModelsFromScene(sceneData);
  BoundingBox cachedSceneBounds = ComputeSceneBounds(models);

  // In render mode, set up camera based on command line args and scene bounds
  if (renderMode && !models.empty()) {
    const BoundingBox& sceneBounds = cachedSceneBounds;

    const bool hasFocusQuery = !renderFocusMaterials.empty() ||
                               !renderFocusObjects.empty() ||
                               !renderFocusCategories.empty();
    BoundingBox focusBounds = {{0.0f, 0.0f, 0.0f}, {0.0f, 0.0f, 0.0f}};
    bool hasFocusBounds = false;
    if (hasFocusQuery) {
      for (const auto& m : models) {
        bool matchesFocus = false;
        if (!m.materialId.empty() &&
            renderFocusMaterials.find(m.materialId) != renderFocusMaterials.end()) {
          matchesFocus = true;
        }
        if (!matchesFocus && m.sceneObjectIndex < sceneData.objects.size()) {
          const auto& obj = sceneData.objects[m.sceneObjectIndex];
          if (!obj.objectId.empty() &&
              renderFocusObjects.find(obj.objectId) != renderFocusObjects.end()) {
            matchesFocus = true;
          }
        }
        if (!matchesFocus && !m.materialId.empty()) {
          const PBRMaterial* mat = g_materialLibrary.get(m.materialId);
          if (mat && renderFocusCategories.find(mat->category) != renderFocusCategories.end()) {
            matchesFocus = true;
          }
        }
        if (matchesFocus) {
          BoundingBox bbox = GetModelBoundingBox(m.model);
          ExpandBounds(focusBounds, bbox, hasFocusBounds);
        }
      }
      if (!hasFocusBounds) {
        TraceLog(LOG_WARNING, "Render focus selectors matched no geometry; falling back to full-scene framing.");
      }
    }

    const BoundingBox framingBounds = (hasFocusBounds ? focusBounds : sceneBounds);
    const float fullSceneSizeRaw = Vector3Distance(sceneBounds.min, sceneBounds.max);
    float fullSceneSize = fullSceneSizeRaw;
    if (fullSceneSize < 0.01f) fullSceneSize = 0.01f;

    Vector3 sceneCenter = {
      (framingBounds.min.x + framingBounds.max.x) * 0.5f,
      (framingBounds.min.y + framingBounds.max.y) * 0.5f,
      (framingBounds.min.z + framingBounds.max.z) * 0.5f
    };
    float framingSize = Vector3Distance(framingBounds.min, framingBounds.max);
    if (framingSize < 0.01f) framingSize = 0.01f;
    float cameraFitSize = framingSize;
    if (hasFocusBounds) {
      // Keep focus shots readable: tiny focus objects should not force an extreme macro zoom.
      cameraFitSize = std::max(cameraFitSize, fullSceneSize * 0.22f);
    }
    // Use global scene scale for target offsets so shot presets remain stable with focus framing.
    const float targetOffsetScale = hasFocusBounds ? fullSceneSize : framingSize;

    // Set camera target
    if (camTargetSet) {
      camera.target = {camTargetX, camTargetY, camTargetZ};
    } else {
      camera.target = sceneCenter;
    }
    if (camTargetOffsetSet) {
      camera.target.x += camTargetOffsetX * targetOffsetScale;
      camera.target.y += camTargetOffsetY * targetOffsetScale;
      camera.target.z += camTargetOffsetZ * targetOffsetScale;
    }

    // Set orbit distance (auto or manual)
    if (camDist > 0.0f) {
      orbitDistance = camDist;
    } else {
      float extentY = framingBounds.max.y - framingBounds.min.y;
      float extentX = std::max(framingBounds.max.x - framingBounds.min.x,
                               framingBounds.max.z - framingBounds.min.z);
      float halfFovY = camera.fovy * 0.5f * DEG2RAD;
      float aspect = static_cast<float>(renderWidth) / static_cast<float>(renderHeight);
      float halfFovX = atanf(tanf(halfFovY) * aspect);
      float distForHeight = (extentY * 0.5f) / tanf(halfFovY);
      float distForWidth = (extentX * 0.5f) / tanf(halfFovX);
      float fovFitDist = std::max(distForHeight, distForWidth) * 1.35f;
      float diagDist = cameraFitSize * 1.2f;
      orbitDistance = std::max({fovFitDist, diagDist, 0.01f}) * camDistScale;
    }

    // Apply yaw and pitch from command line by default.
    orbitYaw = camYaw;
    orbitPitch = camPitch;

    // Optional absolute camera placement for precise interior/detail shots.
    if (camPosSet) {
      camera.position = {camPosX, camPosY, camPosZ};
      Vector3 toCam = Vector3Subtract(camera.position, camera.target);
      float d = Vector3Length(toCam);
      if (d > 0.0001f) {
        orbitDistance = d;
        orbitYaw = atan2f(toCam.x, toCam.z);
        orbitPitch = asinf(toCam.y / d);
      }
    } else {
      // Orbit camera position from target.
      camera.position = Vector3Add(camera.target, {
        orbitDistance * cosf(orbitPitch) * sinf(orbitYaw),
        orbitDistance * sinf(orbitPitch),
        orbitDistance * cosf(orbitPitch) * cosf(orbitYaw)
      });
    }

    TraceLog(LOG_INFO,
             "Render mode camera: yaw=%.1f° pitch=%.1f° dist=%.2f fov=%.1f target=(%.2f,%.2f,%.2f) pos=(%.2f,%.2f,%.2f) absPos=%s focus=%s fit=%.2f full=%.2f",
             orbitYaw * RAD2DEG, orbitPitch * RAD2DEG, orbitDistance, camera.fovy, camera.target.x, camera.target.y, camera.target.z,
             camera.position.x, camera.position.y, camera.position.z, camPosSet ? "yes" : "no",
             hasFocusBounds ? "yes" : "no", cameraFitSize, fullSceneSize);
  }

  // UI State
  UIState uiState;
  if (renderMode && !renderShowUI) {
    uiState.showToolbar = false;
    uiState.showParametersPanel = false;
    uiState.showMaterialsPanel = false;
    uiState.showThermalPanel = false;
    uiState.showStructuralPanel = false;
    uiState.showAssemblyPanel = false;
    uiState.thermalViewEnabled = false;
  }
  std::vector<SceneParameter> sceneParameters;
  std::vector<MaterialItem> sceneMaterials = std::move(initialMaterials);
  ThermalAnalysisResult thermalResult;
  bool thermalResultDirty = true;  // Flag to recalculate when scene changes
  StructuralAnalysisResult structuralResult;
  bool structuralResultDirty = true;  // Flag to recalculate when scene changes
  AssemblyInstructions assemblyInstructions = std::move(initialAssembly);
  if (!assemblyInstructions.steps.empty()) {
    ResolveAssemblyMaterials(assemblyInstructions, sceneData);
  }
  bool assemblyDirty = assemblyInstructions.steps.empty();  // Only regenerate if not scene-defined

  auto refreshParameters = [&]() {
    if (!scriptPath.empty()) {
      sceneParameters = ParseSceneParameters(scriptPath);
      TraceLog(LOG_INFO, "Parsed %zu parameters", sceneParameters.size());
    }
  };

  refreshParameters();

  std::vector<std::pair<std::string, float>> originalParamValues;
  if (!cliParamOverrides.empty()) {
    bool anyWritten = false;
    for (const auto& [name, value] : cliParamOverrides) {
      bool found = false;
      for (auto& param : sceneParameters) {
        if (param.name == name) {
          originalParamValues.push_back({param.name, param.value});
          param.value = value;
          if (WriteParameterToFile(scriptPath, param)) {
            TraceLog(LOG_INFO, "CLI override: %s = %g", name.c_str(), value);
            anyWritten = true;
          }
          found = true;
          break;
        }
      }
      if (!found) {
        std::cerr << "Warning: parameter '" << name << "' not found in scene" << std::endl;
      }
    }
    if (anyWritten) {
      DestroyModels(models);
      auto reloadResult = LoadAndTessellate(scriptPath);
      if (reloadResult.success) {
        sceneData = std::move(reloadResult.sceneData);
        currentDisplayScale = reloadResult.displayScale;
        models = CreateModelsFromPrecomputed(reloadResult.meshes);
        sceneMaterials = std::move(reloadResult.materials);
        if (!reloadResult.assembly.steps.empty()) {
          assemblyInstructions = std::move(reloadResult.assembly);
          ResolveAssemblyMaterials(assemblyInstructions, sceneData);
        }
      }
      refreshParameters();
    }
  }

  TraceLog(LOG_INFO, "Initial load: %zu parameters, %zu materials",
           sceneParameters.size(), sceneMaterials.size());

  // Load shaders
  Shader outlineShader = LoadShaderFromMemory(shaders::kOutlineVS, shaders::kOutlineFS);
  Shader toonShader = LoadShaderFromMemory(shaders::kToonVS, shaders::kToonFS);
  Shader normalDepthShader = LoadShaderFromMemory(shaders::kNormalDepthVS, shaders::kNormalDepthFS);
  Shader edgeShader = LoadShaderFromMemory(shaders::kEdgeQuadVS, shaders::kEdgeFS);
  Shader pbrShader = LoadShaderFromMemory(shaders::kPBR_VS, shaders::kPBR_FS);
  Shader skyShader = LoadShaderFromMemory(shaders::kSky_VS, shaders::kSky_FS);
  Shader debugShader = LoadShaderFromMemory(shaders::kEdgeQuadVS, shaders::kDebugDepthFS);
  Shader ssaoShader = LoadShaderFromMemory(shaders::kEdgeQuadVS, shaders::kSSAOFS);
  Shader ssaoBlurShader = LoadShaderFromMemory(shaders::kEdgeQuadVS, shaders::kSSAOBlurFS);
  Shader fxaaShader = LoadShaderFromMemory(shaders::kEdgeQuadVS, shaders::kFXAA_FS);

  if (outlineShader.id == 0 || toonShader.id == 0 || normalDepthShader.id == 0 || edgeShader.id == 0 || pbrShader.id == 0 || skyShader.id == 0 || debugShader.id == 0 || ssaoShader.id == 0 || ssaoBlurShader.id == 0 || fxaaShader.id == 0) {
    TraceLog(LOG_ERROR, "Failed to load one or more shaders.");
    DestroyModels(models);
    if (brandingFontCustom) UnloadFont(brandingFont);
    if (uiFontCustom) UnloadFont(uiFont);
    JS_FreeRuntime(runtime);
    CloseWindow();
    return 1;
  }

  // Shadow mapping shaders
  Shader shadowDepthShader = LoadShaderFromMemory(shaders::kShadowDepth_VS, shaders::kShadowDepth_FS);
  Shader pbrShadowShader = LoadShaderFromMemory(shaders::kPBRShadow_VS, shaders::kPBRShadow_FS);
  // Enable shadow mapping if both shaders loaded successfully
  bool shadowsEnabled = (shadowDepthShader.id != 0 && pbrShadowShader.id != 0);

  // Ground plane shader
  Shader groundPlaneShader = LoadShaderFromMemory(shaders::kGroundPlane_VS, shaders::kGroundPlane_FS);
  const int locGroundColor = GetShaderLocation(groundPlaneShader, "groundColor");
  const int locHorizonColor = GetShaderLocation(groundPlaneShader, "horizonColor");
  const int locFadeRadius = GetShaderLocation(groundPlaneShader, "fadeRadius");
  const int locSceneCenter = GetShaderLocation(groundPlaneShader, "sceneCenter");
  const int locGPLightDir = GetShaderLocation(groundPlaneShader, "lightDir");
  const int locGPLightColor = GetShaderLocation(groundPlaneShader, "lightColor");
  const int locGPCameraPos = GetShaderLocation(groundPlaneShader, "cameraPos");
  const int locGPShadowMap = GetShaderLocation(groundPlaneShader, "shadowMap");
  const int locGPShadowsActive = GetShaderLocation(groundPlaneShader, "shadowsActive");
  const int locGPLightSpaceMatrix = GetShaderLocation(groundPlaneShader, "lightSpaceMatrix");
  const int locGPGridSpacing = GetShaderLocation(groundPlaneShader, "gridSpacing");
  const int locGPCleanMode = GetShaderLocation(groundPlaneShader, "cleanMode");

  Material groundPlaneMat = LoadMaterialDefault();
  groundPlaneMat.shader = groundPlaneShader;

  // Outline shader setup
  const int locOutline = GetShaderLocation(outlineShader, "outline");
  const int locOutlineColor = GetShaderLocation(outlineShader, "outlineColor");
  Material outlineMat = LoadMaterialDefault();
  outlineMat.shader = outlineShader;

  auto setOutlineUniforms = [&](float worldThickness, Color color) {
    float c[4] = {color.r / 255.0f, color.g / 255.0f, color.b / 255.0f, color.a / 255.0f};
    SetShaderValue(outlineMat.shader, locOutline, &worldThickness, SHADER_UNIFORM_FLOAT);
    SetShaderValue(outlineMat.shader, locOutlineColor, c, SHADER_UNIFORM_VEC4);
  };

  // Toon shader setup
  const int locLightDirVS = GetShaderLocation(toonShader, "lightDirVS");
  const int locBaseColor = GetShaderLocation(toonShader, "baseColor");
  const int locToonSteps = GetShaderLocation(toonShader, "toonSteps");
  const int locAmbient = GetShaderLocation(toonShader, "ambient");
  const int locDiffuseWeight = GetShaderLocation(toonShader, "diffuseWeight");
  const int locRimWeight = GetShaderLocation(toonShader, "rimWeight");
  const int locSpecWeight = GetShaderLocation(toonShader, "specWeight");
  const int locSpecShininess = GetShaderLocation(toonShader, "specShininess");
  const int locAlbedoTex = GetShaderLocation(toonShader, "albedoTex");
  const int locUseTexture = GetShaderLocation(toonShader, "useTexture");
  const int locToonShadowMap = GetShaderLocation(toonShader, "shadowMap");
  const int locToonUseShadows = GetShaderLocation(toonShader, "useShadows");
  const int locToonLightSpaceMatrix = GetShaderLocation(toonShader, "lightSpaceMatrix");
  Material toonMat = LoadMaterialDefault();
  toonMat.shader = toonShader;
  // Tell raylib that our albedoTex sampler is at SHADER_LOC_MAP_DIFFUSE location
  // This makes raylib bind material.maps[MATERIAL_MAP_DIFFUSE].texture to our sampler
  toonShader.locs[SHADER_LOC_MAP_DIFFUSE] = locAlbedoTex;

  // Normal/depth shader setup
  const int locNear = GetShaderLocation(normalDepthShader, "zNear");
  const int locFar = GetShaderLocation(normalDepthShader, "zFar");
  Material normalDepthMat = LoadMaterialDefault();
  normalDepthMat.shader = normalDepthShader;

  // Edge composite shader setup
  const int locNormDepthTexture = GetShaderLocation(edgeShader, "normDepthTex");
  const int locTexel = GetShaderLocation(edgeShader, "texel");
  const int locNormalThreshold = GetShaderLocation(edgeShader, "normalThreshold");
  const int locDepthThreshold = GetShaderLocation(edgeShader, "depthThreshold");
  const int locEdgeIntensity = GetShaderLocation(edgeShader, "edgeIntensity");
  const int locInkColor = GetShaderLocation(edgeShader, "inkColor");
  const int locEdgeSSAOTex = GetShaderLocation(edgeShader, "ssaoTex");
  const int locEdgeSSAOStrength = GetShaderLocation(edgeShader, "ssaoStrength");

  // Debug shader setup
  const int locDebugNormDepthTex = GetShaderLocation(debugShader, "normDepthTex");
  const int locDebugMode = GetShaderLocation(debugShader, "debugMode");

  // SSAO shader setup (texture0 is auto-bound by raylib)
  const int locSSAOTexelSize = GetShaderLocation(ssaoShader, "texelSize");
  const int locSSAORadius = GetShaderLocation(ssaoShader, "ssaoRadius");
  const int locSSAOIntensity = GetShaderLocation(ssaoShader, "ssaoIntensity");
  const int locSSAOZNear = GetShaderLocation(ssaoShader, "zNear");
  const int locSSAOZFar = GetShaderLocation(ssaoShader, "zFar");

  // SSAO blur shader setup (texture0 is auto-bound by raylib)
  const int locSSAOBlurTexelSize = GetShaderLocation(ssaoBlurShader, "texelSize");
  const int locSSAOBlurNDTex = GetShaderLocation(ssaoBlurShader, "normalDepthTex");

  // FXAA shader setup
  const int locFXAATexelSize = GetShaderLocation(fxaaShader, "texelSize");
  const int locFXAAPreserveAlpha = GetShaderLocation(fxaaShader, "preserveAlpha");
  const int locFXAASkipVignette = GetShaderLocation(fxaaShader, "skipVignette");

  // PBR shader setup
  const int locPbrAlbedoColor = GetShaderLocation(pbrShader, "albedoColor");
  const int locPbrMetallic = GetShaderLocation(pbrShader, "metallic");
  const int locPbrRoughness = GetShaderLocation(pbrShader, "roughness");
  const int locPbrAo = GetShaderLocation(pbrShader, "ao");
  const int locPbrAlbedoTex = GetShaderLocation(pbrShader, "albedoTex");
  const int locPbrUseAlbedoTex = GetShaderLocation(pbrShader, "useAlbedoTex");
  const int locPbrLightDir = GetShaderLocation(pbrShader, "lightDir");
  const int locPbrLightColor = GetShaderLocation(pbrShader, "lightColor");
  const int locPbrLightDir2 = GetShaderLocation(pbrShader, "lightDir2");
  const int locPbrLightColor2 = GetShaderLocation(pbrShader, "lightColor2");
  const int locPbrSkyTop = GetShaderLocation(pbrShader, "skyColorTop");
  const int locPbrSkyBottom = GetShaderLocation(pbrShader, "skyColorBottom");
  const int locPbrGround = GetShaderLocation(pbrShader, "groundColor");
  const int locPbrExposure = GetShaderLocation(pbrShader, "exposure");

  Material pbrMat = LoadMaterialDefault();
  pbrMat.shader = pbrShader;
  pbrShader.locs[SHADER_LOC_MAP_DIFFUSE] = locPbrAlbedoTex;

  // PBR environment colors tuned for a Nordic daytime look (Sotunki-like, cool clear air).
  const float pbrSkyTop[3] = {0.30f, 0.45f, 0.65f};
  const float pbrSkyBottom[3] = {0.55f, 0.60f, 0.65f};
  const float pbrGround[3] = {0.36f, 0.43f, 0.33f};
  SetShaderValue(pbrShader, locPbrSkyTop, pbrSkyTop, SHADER_UNIFORM_VEC3);
  SetShaderValue(pbrShader, locPbrSkyBottom, pbrSkyBottom, SHADER_UNIFORM_VEC3);
  SetShaderValue(pbrShader, locPbrGround, pbrGround, SHADER_UNIFORM_VEC3);
  float pbrExposure = 0.85f;
  SetShaderValue(pbrShader, locPbrExposure, &pbrExposure, SHADER_UNIFORM_FLOAT);

  // PBR light (sun-like directional), slightly cooler than the previous warm bias.
  const float pbrLightColor[3] = {2.2f, 2.3f, 2.1f};
  SetShaderValue(pbrShader, locPbrLightColor, pbrLightColor, SHADER_UNIFORM_VEC3);

  // Secondary cool fill from opposite side for shadow readability.
  const float pbrLightColor2[3] = {0.95f, 1.05f, 1.22f};

  // Rendering mode: PBR by default, --toon CLI flag switches to toon
  bool pbrModeEnabled = true;
  for (int i = 1; i < argc; i++) {
    if (std::string(argv[i]) == "--toon") { pbrModeEnabled = false; break; }
  }
  int debugViewMode = 0;  // 0=off, 1=depth, 2=normals, 3=combined (cycle with D)

  // Sky shader setup
  const int locSkyTop = GetShaderLocation(skyShader, "skyTop");
  const int locSkyHorizon = GetShaderLocation(skyShader, "skyHorizon");
  const int locSkyGround = GetShaderLocation(skyShader, "groundColor");

  // Sky gradient tuned for clear Nordic daylight.
  const float skyTopCol[3] = {0.40f, 0.60f, 0.88f};
  const float skyHorizonCol[3] = {0.84f, 0.91f, 0.98f};
  const float skyGroundCol[3] = {0.36f, 0.42f, 0.34f};
  SetShaderValue(skyShader, locSkyTop, skyTopCol, SHADER_UNIFORM_VEC3);
  SetShaderValue(skyShader, locSkyHorizon, skyHorizonCol, SHADER_UNIFORM_VEC3);
  SetShaderValue(skyShader, locSkyGround, skyGroundCol, SHADER_UNIFORM_VEC3);

  Material skyMat = LoadMaterialDefault();
  skyMat.shader = skyShader;

  // Create fullscreen quad mesh for sky rendering (in clip space XY plane)
  // GenMeshPlane creates in XZ, so we rotate the transform when drawing
  Mesh skyQuad = GenMeshPlane(2.0f, 2.0f, 1, 1);
  UploadMesh(&skyQuad, false);
  // Transform to put plane in XY (rotate -90 degrees around X axis)
  Matrix skyTransform = MatrixRotateX(-90.0f * DEG2RAD);

  // Create ground plane mesh for PBR mode (large enough to fill view at typical zoom)
  const float groundPlaneSize = 200.0f;
  Mesh groundPlaneMesh = GenMeshPlane(groundPlaneSize, groundPlaneSize, 1, 1);
  UploadMesh(&groundPlaneMesh, false);
  Matrix groundPlaneTransform = MatrixTranslate(0.0f, -0.01f, 0.0f);  // Slightly below origin

  // ============================================================================
  // Shadow mapping setup - Use standard render texture and encode depth in color
  // ============================================================================
  const int SHADOW_MAP_SIZE = 4096;
  RenderTexture2D shadowMap = {0};
  if (shadowsEnabled) {
    shadowMap = LoadRenderTexture(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    // Set texture filtering for shadow map
    SetTextureFilter(shadowMap.texture, TEXTURE_FILTER_POINT);
    SetTextureWrap(shadowMap.texture, TEXTURE_WRAP_CLAMP);
    TraceLog(LOG_INFO, "Shadow map render texture created successfully (%dx%d)", SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  }

  // Shadow depth shader uniforms
  const int locShadowLightMVP = GetShaderLocation(shadowDepthShader, "lightMVP");

  // PBR Shadow shader uniforms
  const int locPbrShadowAlbedoColor = GetShaderLocation(pbrShadowShader, "albedoColor");
  const int locPbrShadowMetallic = GetShaderLocation(pbrShadowShader, "metallic");
  const int locPbrShadowRoughness = GetShaderLocation(pbrShadowShader, "roughness");
  const int locPbrShadowAo = GetShaderLocation(pbrShadowShader, "ao");
  const int locPbrShadowAlbedoTex = GetShaderLocation(pbrShadowShader, "albedoTex");
  const int locPbrShadowUseAlbedoTex = GetShaderLocation(pbrShadowShader, "useAlbedoTex");
  const int locPbrShadowShadowMap = GetShaderLocation(pbrShadowShader, "shadowMap");
  const int locPbrShadowLightDir = GetShaderLocation(pbrShadowShader, "lightDir");
  const int locPbrShadowLightColor = GetShaderLocation(pbrShadowShader, "lightColor");
  const int locPbrShadowLightDir2 = GetShaderLocation(pbrShadowShader, "lightDir2");
  const int locPbrShadowLightColor2 = GetShaderLocation(pbrShadowShader, "lightColor2");
  const int locPbrShadowSkyTop = GetShaderLocation(pbrShadowShader, "skyColorTop");
  const int locPbrShadowSkyBottom = GetShaderLocation(pbrShadowShader, "skyColorBottom");
  const int locPbrShadowGround = GetShaderLocation(pbrShadowShader, "groundColor");
  const int locPbrShadowExposure = GetShaderLocation(pbrShadowShader, "exposure");
  const int locPbrShadowLightSpaceMatrix = GetShaderLocation(pbrShadowShader, "lightSpaceMatrix");

  // Set PBR shadow shader environment colors (same as regular PBR)
  SetShaderValue(pbrShadowShader, locPbrShadowSkyTop, pbrSkyTop, SHADER_UNIFORM_VEC3);
  SetShaderValue(pbrShadowShader, locPbrShadowSkyBottom, pbrSkyBottom, SHADER_UNIFORM_VEC3);
  SetShaderValue(pbrShadowShader, locPbrShadowGround, pbrGround, SHADER_UNIFORM_VEC3);
  SetShaderValue(pbrShadowShader, locPbrShadowExposure, &pbrExposure, SHADER_UNIFORM_FLOAT);
  SetShaderValue(pbrShadowShader, locPbrShadowLightColor, pbrLightColor, SHADER_UNIFORM_VEC3);

  // Override PBR environment for white/clean background (neutral studio lighting)
  if (renderWhiteBackground) {
    const float whiteSkyTop[3] = {0.55f, 0.57f, 0.62f};
    const float whiteSkyBottom[3] = {0.65f, 0.65f, 0.63f};
    const float whiteGround[3] = {0.58f, 0.56f, 0.52f};
    float whiteExposure = 0.85f;
    SetShaderValue(pbrShader, locPbrSkyTop, whiteSkyTop, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShader, locPbrSkyBottom, whiteSkyBottom, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShader, locPbrGround, whiteGround, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShader, locPbrExposure, &whiteExposure, SHADER_UNIFORM_FLOAT);
    SetShaderValue(pbrShadowShader, locPbrShadowSkyTop, whiteSkyTop, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShadowShader, locPbrShadowSkyBottom, whiteSkyBottom, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShadowShader, locPbrShadowGround, whiteGround, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShadowShader, locPbrShadowExposure, &whiteExposure, SHADER_UNIFORM_FLOAT);
  }

  // Set shadow map sampler to use texture unit 3 (units 0-2 used by post-processing)
  int shadowMapTexUnit = 3;
  SetShaderValue(pbrShadowShader, locPbrShadowShadowMap, &shadowMapTexUnit, SHADER_UNIFORM_INT);

  Material pbrShadowMat = LoadMaterialDefault();
  pbrShadowMat.shader = pbrShadowShader;
  pbrShadowShader.locs[SHADER_LOC_MAP_DIFFUSE] = locPbrShadowAlbedoTex;
  // Disable automatic texture binding for unused slots (prevents Apple Metal errors)
  // Clear all material map textures except diffuse to prevent raylib from binding them
  // Raylib has 12 material map slots (MATERIAL_MAP_BRDF = 11 is the last)
  for (int i = 1; i <= MATERIAL_MAP_BRDF; i++) {
    pbrShadowMat.maps[i].texture.id = 0;
  }
  // Shadow map will be manually bound via rlActiveTextureSlot in draw loop

  Material shadowDepthMat = LoadMaterialDefault();
  shadowDepthMat.shader = shadowDepthShader;
  // Clear unused texture slots for shadowDepthMat too
  for (int i = 1; i <= MATERIAL_MAP_BRDF; i++) {
    shadowDepthMat.maps[i].texture.id = 0;
  }

  // Static lighting configuration (sun + cool fill).
  const Vector3 lightDirWS = Vector3Normalize({0.38f, 0.70f, 0.42f});
  // Secondary fill light - comes from opposite side, lower angle (simulates sky bounce)
  const Vector3 lightDir2WS = Vector3Normalize({-0.58f, 0.42f, -0.55f});
  const float baseCol[4] = {kBaseColor.r / 255.0f, kBaseColor.g / 255.0f, kBaseColor.b / 255.0f, 1.0f};
  SetShaderValue(toonShader, locBaseColor, baseCol, SHADER_UNIFORM_VEC4);

  int toonSteps = 4;
  SetShaderValue(toonShader, locToonSteps, &toonSteps, SHADER_UNIFORM_INT);
  float ambient = 0.6f;
  SetShaderValue(toonShader, locAmbient, &ambient, SHADER_UNIFORM_FLOAT);
  float diffuseWeight = 0.5f;
  SetShaderValue(toonShader, locDiffuseWeight, &diffuseWeight, SHADER_UNIFORM_FLOAT);
  float rimWeight = 0.25f;
  SetShaderValue(toonShader, locRimWeight, &rimWeight, SHADER_UNIFORM_FLOAT);
  float specWeight = 0.12f;
  SetShaderValue(toonShader, locSpecWeight, &specWeight, SHADER_UNIFORM_FLOAT);
  float specShininess = 32.0f;
  SetShaderValue(toonShader, locSpecShininess, &specShininess, SHADER_UNIFORM_FLOAT);
  int useTexture = 0;  // Default: no texture
  SetShaderValue(toonShader, locUseTexture, &useTexture, SHADER_UNIFORM_INT);

  // Load material textures (must be after OpenGL init)
  LoadMaterialTextures();

  // Create a 1x1 white fallback texture for when no material texture is available
  // This ensures the albedoTex sampler is always bound to something valid
  Image whiteImg = GenImageColor(1, 1, WHITE);
  Texture2D fallbackTexture = LoadTextureFromImage(whiteImg);
  UnloadImage(whiteImg);

  // Set fallback texture on toon material - raylib will handle texture unit binding
  // Use MATERIAL_MAP_DIFFUSE (index 0) which raylib binds to texture unit 0
  toonMat.maps[MATERIAL_MAP_DIFFUSE].texture = fallbackTexture;
  pbrMat.maps[MATERIAL_MAP_DIFFUSE].texture = fallbackTexture;

  float normalThreshold = 0.25f;
  float depthThreshold = 0.002f;
  float edgeIntensity = pbrModeEnabled ? 0.3f : 1.0f;
  SetShaderValue(edgeShader, locNormalThreshold, &normalThreshold, SHADER_UNIFORM_FLOAT);
  SetShaderValue(edgeShader, locDepthThreshold, &depthThreshold, SHADER_UNIFORM_FLOAT);
  SetShaderValue(edgeShader, locEdgeIntensity, &edgeIntensity, SHADER_UNIFORM_FLOAT);

  const Color outlineColor = BLACK;
  const float inkColor[4] = {outlineColor.r / 255.0f, outlineColor.g / 255.0f, outlineColor.b / 255.0f, 1.0f};
  SetShaderValue(edgeShader, locInkColor, inkColor, SHADER_UNIFORM_VEC4);

  // Render targets
  struct RenderTargets {
    RenderTexture2D color;
    RenderTexture2D normDepth;
    RenderTexture2D ssaoRaw;
    RenderTexture2D ssaoBlur;
    RenderTexture2D fxaa;  // For FXAA anti-aliasing pass
  };

  // Supersampling factor for anti-aliasing (2 = render at 2x resolution)
  const int ssaaFactor = 2;

  auto makeRenderTargets = [&]() {
    const int width = std::max(GetScreenWidth(), 1);
    const int height = std::max(GetScreenHeight(), 1);
    // Main render targets at supersampled resolution
    const int ssWidth = width * ssaaFactor;
    const int ssHeight = height * ssaaFactor;
    RenderTargets rt;
    rt.color = LoadRenderTexture(ssWidth, ssHeight);
    rt.normDepth = LoadRenderTexture(ssWidth, ssHeight);
    rt.ssaoRaw = LoadRenderTexture(ssWidth, ssHeight);
    rt.ssaoBlur = LoadRenderTexture(ssWidth, ssHeight);
    rt.fxaa = LoadRenderTexture(width, height);  // FXAA at screen resolution
    return rt;
  };

  RenderTargets rt = makeRenderTargets();
  auto& rtColor = rt.color;
  auto& rtNormalDepth = rt.normDepth;
  auto& rtSSAORaw = rt.ssaoRaw;
  auto& rtSSAOBlur = rt.ssaoBlur;
  auto& rtFXAA = rt.fxaa;
  SetShaderValueTexture(edgeShader, locNormDepthTexture, rtNormalDepth.texture);
  const float initialTexel[2] = {
      1.0f / static_cast<float>(rtNormalDepth.texture.width),
      1.0f / static_cast<float>(rtNormalDepth.texture.height)};
  SetShaderValue(edgeShader, locTexel, initialTexel, SHADER_UNIFORM_VEC2);

  int prevScreenWidth = GetScreenWidth();
  int prevScreenHeight = GetScreenHeight();
  const float zNear = 0.1f;
  const float zFar = 1000.0f;  // Restored to allow distant objects

  int frameCount = 0;
  bool screenshotTaken = false;
  int turntableIndex = 0;
  float turntableBaseYaw = camYaw;

  // File-watch debounce state
  bool fileChangePending = false;
  auto fileChangeDetectedTime = std::chrono::steady_clock::now();

  // Background loading state
  std::future<BackgroundLoadResult> backgroundLoadFuture;
  bool loadingInBackground = false;
  bool reloadPending = false;
  auto backgroundLoadStartTime = std::chrono::high_resolution_clock::now();

  auto startBackgroundLoad = [&]() {
    if (loadingInBackground) {
      reloadPending = true;
      TraceLog(LOG_INFO, "Background load in progress, queuing reload");
      return;
    }
    loadingInBackground = true;
    backgroundLoadStartTime = std::chrono::high_resolution_clock::now();
    reportStatus("Loading...");

    backgroundLoadFuture = std::async(std::launch::async, [scriptPath]() {
      return LoadAndTessellate(scriptPath);
    });
    TraceLog(LOG_INFO, "Started background load");
  };

  auto checkBackgroundLoad = [&]() {
    if (!loadingInBackground) return;

    if (backgroundLoadFuture.wait_for(std::chrono::milliseconds(0)) != std::future_status::ready) {
      return;
    }

    BackgroundLoadResult result = backgroundLoadFuture.get();
    loadingInBackground = false;

    auto totalMs = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::high_resolution_clock::now() - backgroundLoadStartTime).count();

    if (result.success) {
      sceneData = std::move(result.sceneData);
      currentDisplayScale = result.displayScale;
      DestroyModels(models);
      models = CreateModelsFromPrecomputed(result.meshes);
      reportStatus(result.message);
      sceneParameters = ParseSceneParameters(scriptPath);
      sceneMaterials = std::move(result.materials);
      // Use scene-defined assembly if available, otherwise regenerate
      if (!result.assembly.steps.empty()) {
        assemblyInstructions = std::move(result.assembly);
        ResolveAssemblyMaterials(assemblyInstructions, sceneData);
        assemblyDirty = false;
        TraceLog(LOG_INFO, "Using scene-defined assembly: %zu steps", assemblyInstructions.steps.size());
      } else {
        assemblyDirty = true;  // Regenerate assembly after scene reload
      }
      thermalResultDirty = true;  // Recalculate thermal after scene reload
      structuralResultDirty = true;  // Recalculate structural after scene reload
      uiState.currentAssemblyStep = 0;  // Reset to first step
      TraceLog(LOG_INFO, "Updated %zu parameters and %zu materials from reload",
               sceneParameters.size(), sceneMaterials.size());
      cachedSceneBounds = ComputeSceneBounds(models);
      TraceLog(LOG_INFO, "PROFILE: Background load completed, total wall time: %lld ms", totalMs);
    } else {
      reportStatus(result.message);
      TraceLog(LOG_WARNING, "Background load failed: %s", result.message.c_str());
    }

    if (!result.dependencies.empty()) {
      setWatchedFiles(result.dependencies);
    }

    if (reloadPending) {
      reloadPending = false;
      startBackgroundLoad();
    }
  };

  // Main loop
  while (!WindowShouldClose()) {
    frameCount++;
    const Vector2 mouseDelta = GetMouseDelta();

    checkBackgroundLoad();

    // File watching with debounce to avoid rapid reloads during auto-save
    if (!scriptPath.empty()) {
      bool changed = false;
      if (!loadingInBackground) {
        for (const auto &entry : watchedFiles) {
          std::error_code ec;
          auto currentTs = std::filesystem::last_write_time(entry.first, ec);
          if (ec) {
            if (entry.second.timestamp.has_value()) {
              changed = true;
              break;
            }
          } else if (!entry.second.timestamp.has_value() || currentTs != *entry.second.timestamp) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        fileChangeDetectedTime = std::chrono::steady_clock::now();
        fileChangePending = true;
      }
      if (fileChangePending && !loadingInBackground) {
        auto elapsed = std::chrono::steady_clock::now() - fileChangeDetectedTime;
        if (elapsed >= std::chrono::milliseconds(150)) {
          fileChangePending = false;
          startBackgroundLoad();
        }
      }
    }

    // Skip global hotkeys when search filter is active (typing in search box)
    if (!uiState.materialFilterActive) {
      if (IsKeyPressed(KEY_R) && !scriptPath.empty()) {
        startBackgroundLoad();
      }

      // Panel toggle hotkeys
      if (IsKeyPressed(KEY_T)) {
        uiState.showParametersPanel = !uiState.showParametersPanel;
      }
      if (IsKeyPressed(KEY_M)) {
        uiState.showMaterialsPanel = !uiState.showMaterialsPanel;
      }
      if (IsKeyPressed(KEY_H)) {
        uiState.thermalViewEnabled = !uiState.thermalViewEnabled;
        uiState.showThermalPanel = uiState.thermalViewEnabled;
        if (uiState.thermalViewEnabled) {
          thermalResultDirty = true;  // Recalculate on toggle
        }
      }
      if (IsKeyPressed(KEY_F3)) {
        uiState.showStructuralPanel = !uiState.showStructuralPanel;
        if (uiState.showStructuralPanel) {
          structuralResultDirty = true;
        }
      }
      if (IsKeyPressed(KEY_F4)) {
        uiState.showAssemblyPanel = !uiState.showAssemblyPanel;
        // Only regenerate if no scene-defined assembly exists
        if (uiState.showAssemblyPanel && assemblyInstructions.steps.empty()) {
          assemblyDirty = true;
        }
      }
      if (IsKeyPressed(KEY_P)) {
        pbrModeEnabled = !pbrModeEnabled;
        edgeIntensity = pbrModeEnabled ? 0.3f : 1.0f;
        SetShaderValue(edgeShader, locEdgeIntensity, &edgeIntensity, SHADER_UNIFORM_FLOAT);
        TraceLog(LOG_INFO, "Rendering mode: %s", pbrModeEnabled ? "PBR (Realistic)" : "Toon (Stylized)");
      }
      if (IsKeyPressed(KEY_F9)) {
        debugViewMode = (debugViewMode + 1) % 7;  // Cycle: normal -> raw -> depth -> normals -> combined -> SSAO raw -> SSAO blur -> normal
        const char* modeNames[] = {"Normal", "Raw (no post)", "Depth", "Normals", "Combined", "SSAO Raw", "SSAO Blur"};
        TraceLog(LOG_INFO, "Debug view: %s, Render mode: %s (F9 to cycle)",
                 modeNames[debugViewMode], pbrModeEnabled ? "PBR" : "Toon");
      }
      // Assembly step navigation with arrow keys (when panel is visible)
      if (uiState.showAssemblyPanel) {
        if (IsKeyPressed(KEY_LEFT) && uiState.currentAssemblyStep > 0) {
          uiState.currentAssemblyStep--;
        }
        if (IsKeyPressed(KEY_RIGHT) && uiState.currentAssemblyStep < static_cast<int>(assemblyInstructions.steps.size()) - 1) {
          uiState.currentAssemblyStep++;
        }
      }
    }

    // STL Export handling - Ctrl+E or toolbar button
    bool exportRequested = uiState.stlExportClicked;
    uiState.stlExportClicked = false;
    if (!uiState.materialFilterActive && !exportRequested) {
      if (IsKeyDown(KEY_LEFT_CONTROL) && IsKeyPressed(KEY_E)) {
        exportRequested = true;
      }
    }

    if (exportRequested && !sceneData.objects.empty()) {
      std::vector<manifold::Manifold> allGeometry;
      allGeometry.reserve(sceneData.objects.size());
      for (const auto &obj : sceneData.objects) {
        if (obj.geometry) allGeometry.push_back(*obj.geometry);
      }

      if (!allGeometry.empty()) {
        manifold::Manifold combined = manifold::Manifold::Compose(allGeometry);

        auto downloads = GetDownloadsDir();
        std::error_code dirErr;
        std::filesystem::create_directories(downloads, dirErr);
        if (dirErr && !std::filesystem::exists(downloads)) {
          reportStatus("Export failed: cannot access " + downloads.string());
        } else {
          std::string stlName = scriptPath.stem().string();
          if (stlName == "main") stlName = scriptPath.parent_path().filename().string();
          std::filesystem::path savePath = downloads / (stlName + ".stl");
          std::string error;
          if (WriteMeshAsBinaryStl(combined.GetMeshGL(), savePath, error)) {
            reportStatus("Saved " + savePath.string());
          } else {
            reportStatus(error);
          }
        }
      }
    }

    // OBJ Export handling - Ctrl+O
    if (!uiState.materialFilterActive &&
        IsKeyDown(KEY_LEFT_CONTROL) && IsKeyPressed(KEY_O) &&
        !sceneData.objects.empty()) {
      std::vector<manifold::Manifold> allGeometry;
      allGeometry.reserve(sceneData.objects.size());
      for (const auto &obj : sceneData.objects) {
        if (obj.geometry) allGeometry.push_back(*obj.geometry);
      }
      if (!allGeometry.empty()) {
        manifold::Manifold combined = manifold::Manifold::Compose(allGeometry);
        auto downloads = GetDownloadsDir();
        std::error_code dirErr;
        std::filesystem::create_directories(downloads, dirErr);
        if (dirErr && !std::filesystem::exists(downloads)) {
          reportStatus("Export failed: cannot access " + downloads.string());
        } else {
          std::string objName = scriptPath.stem().string();
          if (objName == "main") objName = scriptPath.parent_path().filename().string();
          std::filesystem::path savePath = downloads / (objName + ".obj");
          std::string error;
          if (WriteMeshAsObj(combined.GetMeshGL(), savePath, error)) {
            reportStatus("Saved " + savePath.string());
          } else {
            reportStatus(error);
          }
        }
      }
    }

    // IFC Export handling - Ctrl+I or toolbar button
    bool ifcExportRequested = uiState.ifcExportClicked;
    uiState.ifcExportClicked = false;
    if (!uiState.materialFilterActive && !ifcExportRequested) {
      if (IsKeyDown(KEY_LEFT_CONTROL) && IsKeyPressed(KEY_I)) {
        ifcExportRequested = true;
      }
    }

    if (ifcExportRequested && !sceneData.objects.empty()) {
      auto downloads = GetDownloadsDir();
      std::error_code dirErr;
      std::filesystem::create_directories(downloads, dirErr);
      if (dirErr && !std::filesystem::exists(downloads)) {
        reportStatus("IFC export failed: cannot access " + downloads.string());
      } else {
        std::string ifcName = scriptPath.stem().string() + ".ifc";
        std::filesystem::path ifcPath = downloads / ifcName;
        std::string error;
        if (ExportToIFC(sceneData, sceneMaterials, g_materialLibrary, ifcPath, error)) {
          reportStatus("Saved ~/Downloads/" + ifcName);
        } else {
          reportStatus("IFC export failed: " + error);
        }
      }
    }

    // SVG Blueprint Export handling - toolbar button
    if (uiState.svgExportClicked) {
      uiState.svgExportClicked = false;
      if (!sceneData.objects.empty()) {
        auto downloads = GetDownloadsDir();
        std::error_code dirErr;
        std::filesystem::create_directories(downloads, dirErr);
        if (dirErr && !std::filesystem::exists(downloads)) {
          reportStatus("SVG export failed: cannot access Downloads");
        } else {
          std::string svgName = scriptPath.stem().string() + "_blueprint.svg";
          std::filesystem::path svgPath = downloads / svgName;
          BlueprintOptions options;
          std::string error;
          if (ExportToSVG(sceneData, sceneMaterials, g_materialLibrary, svgPath, options, error)) {
            reportStatus("Saved ~/Downloads/" + svgName);
          } else {
            reportStatus("SVG export failed: " + error);
          }
        }
      }
    }

    // BOM/Parts List Export handling - toolbar button
    if (uiState.bomExportClicked) {
      uiState.bomExportClicked = false;
      if (!sceneMaterials.empty()) {
        auto downloads = GetDownloadsDir();
        std::error_code dirErr;
        std::filesystem::create_directories(downloads, dirErr);
        if (dirErr && !std::filesystem::exists(downloads)) {
          reportStatus("BOM export failed: cannot access Downloads");
        } else {
          std::string csvName = scriptPath.stem().string() + "_parts.csv";
          std::filesystem::path csvPath = downloads / csvName;
          std::string error;
          if (ExportPartsList(sceneMaterials, g_materialLibrary, csvPath, error)) {
            reportStatus("Saved ~/Downloads/" + csvName);
          } else {
            reportStatus("BOM export failed: " + error);
          }
        }
      }
    }

    // IKEA-style Assembly Instructions Export handling - toolbar button
    if (uiState.instructionsExportClicked) {
      uiState.instructionsExportClicked = false;
      if (!sceneData.objects.empty()) {
        // Regenerate assembly if needed
        if (assemblyInstructions.steps.empty()) {
          assemblyInstructions = GenerateDefaultAssembly(sceneData, sceneMaterials);
        }

        auto downloads = GetDownloadsDir();
        std::string instrName = scriptPath.stem().string() + "_instructions";
        std::filesystem::path instructionsDir = downloads / instrName;
        std::string error;
        if (ExportAssemblyInstructions(sceneData, sceneMaterials, g_materialLibrary,
                                       assemblyInstructions, instructionsDir, error)) {
          reportStatus("Saved ~/Downloads/" + instrName + "/");
        } else {
          reportStatus("Instructions export failed: " + error);
        }
      }
    }

    // Mouse over panel check
    const int screenWidth = std::max(GetScreenWidth(), 1);
    const int screenHeight = std::max(GetScreenHeight(), 1);
    bool mouseOverPanel = IsMouseOverPanels(sceneMaterials, sceneParameters,
                                            uiState.showMaterialsPanel, uiState.showParametersPanel,
                                            screenWidth, screenHeight);

    // Object picking with middle-click or Shift+Left-click
    // This allows reverse selection: click on 3D object to highlight its material
    if (!mouseOverPanel &&
        (IsMouseButtonPressed(MOUSE_BUTTON_MIDDLE) ||
         (IsKeyDown(KEY_LEFT_SHIFT) && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)))) {
      Vector2 mousePos = GetMousePosition();
      Ray pickRay = GetMouseRay(mousePos, camera);
      PickResult pickResult = PickModelAtRay(pickRay, models);

      if (pickResult.hit && !pickResult.materialId.empty()) {
        uiState.selectedMaterialId = pickResult.materialId;

        // Calculate scroll offset to show the selected material in the panel
        // Find the material index and scroll to it
        float scrollTarget = 0.0f;
        float yPos = 5.0f;  // Initial padding
        const float rowHeight = 24.0f;
        const float sectionHeight = 26.0f;
        std::string prevCategory;
        for (size_t i = 0; i < sceneMaterials.size(); ++i) {
          const auto& mat = sceneMaterials[i];
          if (mat.category != prevCategory) {
            prevCategory = mat.category;
            yPos += 5.0f + sectionHeight;
          }
          if (mat.materialId == pickResult.materialId) {
            // Scroll to center this item (adjust by half the visible height)
            scrollTarget = std::max(0.0f, yPos - 100.0f);
            break;
          }
          yPos += rowHeight;
        }
        uiState.materialScrollOffset = scrollTarget;

        // Ensure materials panel is visible
        uiState.showMaterialsPanel = true;

        TraceLog(LOG_INFO, "Picked object with material: %s", pickResult.materialId.c_str());
      } else if (pickResult.hit) {
        // Clicked on object without materialId - clear selection
        uiState.selectedMaterialId.clear();
      }
    }

    // Camera controls (skip if shift is held - that's for object picking, or if dragging a panel)
    bool isDraggingPanel = uiState.draggingPanel >= 0;
    if (!mouseOverPanel && !isDraggingPanel && !IsKeyDown(KEY_LEFT_SHIFT) && IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
      orbitYaw -= mouseDelta.x * 0.01f;
      orbitPitch += mouseDelta.y * 0.01f;
      const float limit = DEG2RAD * 89.0f;
      orbitPitch = Clamp(orbitPitch, -limit, limit);
    }

    const float wheel = GetMouseWheelMove();
    if (!mouseOverPanel && !isDraggingPanel && wheel != 0.0f) {
      orbitDistance *= (1.0f - wheel * 0.1f);
      orbitDistance = Clamp(orbitDistance, 0.05f, 500.0f);
    }

    const Vector3 forward = Vector3Normalize(Vector3Subtract(camera.target, camera.position));
    const Vector3 worldUp = {0.0f, 1.0f, 0.0f};
    const Vector3 right = Vector3Normalize(Vector3CrossProduct(worldUp, forward));
    const Vector3 camUp = Vector3CrossProduct(forward, right);

    if (!mouseOverPanel && !isDraggingPanel && IsMouseButtonDown(MOUSE_BUTTON_RIGHT)) {
      camera.target = Vector3Add(camera.target, Vector3Scale(right, mouseDelta.x * 0.01f * orbitDistance));
      camera.target = Vector3Add(camera.target, Vector3Scale(camUp, -mouseDelta.y * 0.01f * orbitDistance));
    }

    // Skip camera movement keys when search filter is active
    if (!uiState.materialFilterActive) {
      if (IsKeyPressed(KEY_SPACE)) {
        camera.target = initialTarget;
        orbitDistance = initialDistance;
        orbitYaw = initialYaw;
        orbitPitch = initialPitch;
      }

      bool ctrl = IsKeyDown(KEY_LEFT_CONTROL) || IsKeyDown(KEY_RIGHT_CONTROL);
      const float moveSpeed = 0.05f * orbitDistance;
      if (IsKeyDown(KEY_W)) camera.target = Vector3Add(camera.target, Vector3Scale(forward, moveSpeed));
      if (IsKeyDown(KEY_S)) camera.target = Vector3Add(camera.target, Vector3Scale(forward, -moveSpeed));
      if (IsKeyDown(KEY_A)) camera.target = Vector3Add(camera.target, Vector3Scale(right, -moveSpeed));
      if (IsKeyDown(KEY_D)) camera.target = Vector3Add(camera.target, Vector3Scale(right, moveSpeed));
      if (IsKeyDown(KEY_Q)) camera.target = Vector3Add(camera.target, Vector3Scale(worldUp, -moveSpeed));
      if (!ctrl && IsKeyDown(KEY_E)) camera.target = Vector3Add(camera.target, Vector3Scale(worldUp, moveSpeed));
    }

    const Vector3 offsets = {
        orbitDistance * cosf(orbitPitch) * sinf(orbitYaw),
        orbitDistance * sinf(orbitPitch),
        orbitDistance * cosf(orbitPitch) * cosf(orbitYaw)};
    camera.position = Vector3Add(camera.target, offsets);
    camera.up = worldUp;

    // Handle window resize
    if (screenWidth != prevScreenWidth || screenHeight != prevScreenHeight) {
      UnloadRenderTexture(rtColor);
      UnloadRenderTexture(rtNormalDepth);
      UnloadRenderTexture(rtSSAORaw);
      UnloadRenderTexture(rtSSAOBlur);
      UnloadRenderTexture(rtFXAA);
      auto resizedTargets = makeRenderTargets();
      rtColor = resizedTargets.color;
      rtNormalDepth = resizedTargets.normDepth;
      rtSSAORaw = resizedTargets.ssaoRaw;
      rtSSAOBlur = resizedTargets.ssaoBlur;
      rtFXAA = resizedTargets.fxaa;
      SetShaderValueTexture(edgeShader, locNormDepthTexture, rtNormalDepth.texture);
      const float texel[2] = {
          1.0f / static_cast<float>(rtNormalDepth.texture.width),
          1.0f / static_cast<float>(rtNormalDepth.texture.height)};
      SetShaderValue(edgeShader, locTexel, texel, SHADER_UNIFORM_VEC2);
      prevScreenWidth = screenWidth;
      prevScreenHeight = screenHeight;
    }

    // Update shader uniforms
    Matrix view = GetCameraMatrix(camera);
    Vector3 lightDirVS = {
        view.m0 * lightDirWS.x + view.m4 * lightDirWS.y + view.m8 * lightDirWS.z,
        view.m1 * lightDirWS.x + view.m5 * lightDirWS.y + view.m9 * lightDirWS.z,
        view.m2 * lightDirWS.x + view.m6 * lightDirWS.y + view.m10 * lightDirWS.z};
    lightDirVS = Vector3Normalize(lightDirVS);
    SetShaderValue(toonShader, locLightDirVS, &lightDirVS.x, SHADER_UNIFORM_VEC3);

    // Update PBR shader light directions (world space)
    SetShaderValue(pbrShader, locPbrLightDir, &lightDirWS.x, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShader, locPbrLightDir2, &lightDir2WS.x, SHADER_UNIFORM_VEC3);
    SetShaderValue(pbrShader, locPbrLightColor2, pbrLightColor2, SHADER_UNIFORM_VEC3);

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

    // Recalculate thermal analysis if needed
    if (uiState.thermalViewEnabled && thermalResultDirty) {
      thermalResult = CalculateThermalLoss(models, sceneMaterials, g_materialLibrary, uiState.thermalSettings);
      CalculateAnnualThermal(thermalResult, uiState.thermalSettings);  // Add annual heating calc
      thermalResultDirty = false;
      TraceLog(LOG_INFO, "Thermal analysis: %.1f W total heat loss, %.0f kWh/year, %zu surfaces",
               thermalResult.totalHeatLoss_W, thermalResult.annualHeatLoss_kWh, thermalResult.surfaces.size());
    }

    // Recalculate structural analysis if needed
    if (uiState.showStructuralPanel && structuralResultDirty) {
      structuralResult = AnalyzeStructure(models, sceneData, g_materialLibrary, kSceneScale);
      structuralResultDirty = false;
      TraceLog(LOG_INFO, "Structural analysis: %d warnings, %s",
               structuralResult.warningCount,
               structuralResult.allPassed ? "all OK" : "issues found");
    }

    // Regenerate assembly instructions if needed
    if (assemblyDirty && !sceneData.objects.empty()) {
      assemblyInstructions = GenerateDefaultAssembly(sceneData, sceneMaterials);
      assemblyDirty = false;
      uiState.currentAssemblyStep = 0;  // Reset to first step
      TraceLog(LOG_INFO, "Generated %zu assembly steps", assemblyInstructions.steps.size());
    }

    // Build thermal color lookup map for rendering
    std::unordered_map<std::string, Color> thermalColorByMaterial;
    if (uiState.thermalViewEnabled) {
      for (const auto& surface : thermalResult.surfaces) {
        thermalColorByMaterial[surface.materialId] = HeatFluxToColor(
            surface.heatFluxDensity, thermalResult.minHeatFlux, thermalResult.maxHeatFlux);
      }
    }

    auto renderObjectFiltered = [&](const ModelWithColor& modelWithColor) {
      if (!renderMode) return false;
      size_t objIdx = modelWithColor.sceneObjectIndex;
      if (objIdx >= sceneData.objects.size()) {
        return !renderShowObjects.empty();
      }
      const auto& obj = sceneData.objects[objIdx];
      if (!renderShowObjects.empty()) {
        if (obj.objectId.empty() ||
            renderShowObjects.find(obj.objectId) == renderShowObjects.end()) {
          return true;
        }
      }
      if (!obj.objectId.empty() &&
          renderHiddenObjects.find(obj.objectId) != renderHiddenObjects.end()) {
        return true;
      }
      return false;
    };

    // Build assembly visibility set if in assembly mode
    std::set<size_t> assemblyVisibleSet;
    std::set<size_t> assemblyNewSet;
    if (uiState.showAssemblyPanel && !assemblyInstructions.steps.empty()) {
      int stepIdx = std::clamp(uiState.currentAssemblyStep, 0,
                               static_cast<int>(assemblyInstructions.steps.size()) - 1);
      const auto& step = assemblyInstructions.steps[stepIdx];
      assemblyVisibleSet.insert(step.objectIndices.begin(), step.objectIndices.end());
      assemblyNewSet.insert(step.newObjectIndices.begin(), step.newObjectIndices.end());
    }

    auto shouldSkipObject = [&](const ModelWithColor& mc) -> bool {
      if (renderObjectFiltered(mc)) return true;
      if (renderMode && !mc.materialId.empty()) {
        if (renderHiddenMaterials.find(mc.materialId) != renderHiddenMaterials.end())
          return true;
        const PBRMaterial* mat = g_materialLibrary.get(mc.materialId);
        if (mat && renderHiddenCategories.find(mat->category) != renderHiddenCategories.end())
          return true;
      }
      size_t objIdx = mc.sceneObjectIndex;
      if (!uiState.showAssemblyPanel && objIdx < sceneData.objects.size() &&
          sceneData.objects[objIdx].assemblyOnly)
        return true;
      if (uiState.showAssemblyPanel && !assemblyVisibleSet.empty() &&
          assemblyVisibleSet.find(objIdx) == assemblyVisibleSet.end())
        return true;
      if (uiState.thermalViewEnabled && !mc.materialId.empty()) {
        const PBRMaterial* mat = g_materialLibrary.get(mc.materialId);
        if (mat) {
          const std::string& cat = mat->category;
          if (cat == "sheathing" || cat == "roofing" || cat == "finish")
            return true;
        }
      }
      return false;
    };

    // ========================================================================
    // SHADOW MAP PASS - Render depth from light's perspective
    // ========================================================================
    Matrix lightSpaceMatrix = MatrixIdentity();
    if (shadowsEnabled) {
      Vector3 lightDir = lightDirWS;
      Vector3 sceneCenter = {
        (cachedSceneBounds.min.x + cachedSceneBounds.max.x) * 0.5f,
        (cachedSceneBounds.min.y + cachedSceneBounds.max.y) * 0.5f,
        (cachedSceneBounds.min.z + cachedSceneBounds.max.z) * 0.5f
      };
      float sceneRadius = std::max(Vector3Distance(cachedSceneBounds.min, cachedSceneBounds.max) * 0.5f, 0.1f);

      // Light view matrix - looking at scene from light direction
      Vector3 lightPos = Vector3Add(sceneCenter, Vector3Scale(lightDir, sceneRadius * 2.0f));
      Matrix lightView = MatrixLookAt(lightPos, sceneCenter, {0.0f, 1.0f, 0.0f});

      // Orthographic projection for directional light
      float orthoSize = sceneRadius * 1.5f;
      Matrix lightProj = MatrixOrtho(-orthoSize, orthoSize, -orthoSize, orthoSize, 0.1f, sceneRadius * 4.0f);

      lightSpaceMatrix = MatrixMultiply(lightView, lightProj);

      // Render shadow map (depth encoded in color texture)
      BeginTextureMode(shadowMap);
      ClearBackground(WHITE);  // White = max depth (far away)

      // Set up orthographic camera from light's perspective
      Camera3D lightCam = {0};
      lightCam.position = lightPos;
      lightCam.target = sceneCenter;
      lightCam.up = {0.0f, 1.0f, 0.0f};
      lightCam.fovy = orthoSize * 2.0f;  // Full width for ortho
      lightCam.projection = CAMERA_ORTHOGRAPHIC;

      // Set tight clip planes so shadow depth has usable precision
      float shadowNear = 0.01f;
      float shadowFar = sceneRadius * 4.0f;
      rlSetClipPlanes(shadowNear, shadowFar);

      BeginMode3D(lightCam);

      // Get the actual view-projection matrix that Raylib is using
      Matrix lightViewMat = rlGetMatrixModelview();
      Matrix lightProjMat = rlGetMatrixProjection();
      lightSpaceMatrix = MatrixMultiply(lightViewMat, lightProjMat);

      // Cull front faces during shadow pass — back-face depth avoids self-shadow acne
      rlEnableBackfaceCulling();
      glCullFace(GL_FRONT);

      for (const auto &modelWithColor : models) {
        if (shouldSkipObject(modelWithColor)) continue;
        for (int i = 0; i < modelWithColor.model.meshCount; ++i) {
          DrawMesh(modelWithColor.model.meshes[i], shadowDepthMat, modelWithColor.model.transform);
        }
      }

      // Restore normal back-face culling
      glCullFace(GL_BACK);

      EndMode3D();
      EndTextureMode();

      // Restore default clip planes for main camera
      rlSetClipPlanes(RL_CULL_DISTANCE_NEAR, RL_CULL_DISTANCE_FAR);

      // Update PBR shadow shader with light space matrix
      SetShaderValueMatrix(pbrShadowShader, locPbrShadowLightSpaceMatrix, lightSpaceMatrix);
      SetShaderValue(pbrShadowShader, locPbrShadowLightDir, &lightDirWS.x, SHADER_UNIFORM_VEC3);
      SetShaderValue(pbrShadowShader, locPbrShadowLightDir2, &lightDir2WS.x, SHADER_UNIFORM_VEC3);
      SetShaderValue(pbrShadowShader, locPbrShadowLightColor2, pbrLightColor2, SHADER_UNIFORM_VEC3);

      // Shadow map is manually bound to texture unit 3 in the draw loop below

      // Also set for toon shader if shadows are available
      SetShaderValueMatrix(toonShader, locToonLightSpaceMatrix, lightSpaceMatrix);
    }

    // ========================================================================
    // MAIN COLOR PASS
    // ========================================================================

    // Render to color texture
    BeginTextureMode(rtColor);
    ClearBackground(renderTransparentBg ? BLANK : (renderWhiteBackground ? WHITE : RAYWHITE));

    // Render sky gradient background
    if (!renderWhiteBackground && !renderTransparentBg) {
      Color skyTopC, skyHorizC, skyGroundC;
      if (pbrModeEnabled) {
        skyTopC = {static_cast<unsigned char>(skyTopCol[0] * 255),
                   static_cast<unsigned char>(skyTopCol[1] * 255),
                   static_cast<unsigned char>(skyTopCol[2] * 255), 255};
        skyHorizC = {static_cast<unsigned char>(skyHorizonCol[0] * 255),
                     static_cast<unsigned char>(skyHorizonCol[1] * 255),
                     static_cast<unsigned char>(skyHorizonCol[2] * 255), 255};
        skyGroundC = {static_cast<unsigned char>(skyGroundCol[0] * 255),
                      static_cast<unsigned char>(skyGroundCol[1] * 255),
                      static_cast<unsigned char>(skyGroundCol[2] * 255), 255};
      } else {
        skyTopC = {210, 215, 220, 255};
        skyHorizC = {230, 232, 235, 255};
        skyGroundC = {195, 200, 195, 255};
      }

      int h = rtColor.texture.height;
      int w = rtColor.texture.width;

      Vector3 camFwd = Vector3Normalize(Vector3Subtract(camera.target, camera.position));
      float pitch = asinf(camFwd.y);
      float fovY = camera.fovy * DEG2RAD;
      int horizonY = (int)(h * 0.5f + (h * 0.5f) * tanf(pitch) / tanf(fovY * 0.5f));
      horizonY = Clamp(horizonY, 0, h);

      if (horizonY > 0) {
        DrawRectangleGradientV(0, 0, w, horizonY, skyTopC, skyHorizC);
      }
      if (horizonY < h) {
        DrawRectangleGradientV(0, horizonY, w, h - horizonY, skyHorizC, skyGroundC);
      }
    }

    BeginMode3D(camera);
    if (pbrModeEnabled && !renderTransparentBg) {
      // Draw ground plane positioned at cached scene bounds
      float minY = cachedSceneBounds.min.y;
      float centerX = (cachedSceneBounds.min.x + cachedSceneBounds.max.x) * 0.5f;
      float centerZ = (cachedSceneBounds.min.z + cachedSceneBounds.max.z) * 0.5f;

      // Set ground plane shader uniforms
      float gpGroundCol[3], gpHorizonCol[3];
      float gpCleanMode = 0.0f;
      if (renderWhiteBackground) {
        gpGroundCol[0] = 1.0f; gpGroundCol[1] = 1.0f; gpGroundCol[2] = 1.0f;
        gpHorizonCol[0] = 1.0f; gpHorizonCol[1] = 1.0f; gpHorizonCol[2] = 1.0f;
        gpCleanMode = 1.0f;
      } else {
        gpGroundCol[0] = 0.60f; gpGroundCol[1] = 0.58f; gpGroundCol[2] = 0.55f;
        gpHorizonCol[0] = skyGroundCol[0]; gpHorizonCol[1] = skyGroundCol[1]; gpHorizonCol[2] = skyGroundCol[2];
      }
      float gpFadeRadius = groundPlaneSize * (renderWhiteBackground ? 0.35f : 0.5f);
      float gpCenter[3] = {centerX, 0.0f, centerZ};
      float gpLightCol[3] = {1.0f, 0.95f, 0.9f};
      float gpCamPos[3] = {camera.position.x, camera.position.y, camera.position.z};
      SetShaderValue(groundPlaneShader, locGroundColor, gpGroundCol, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locHorizonColor, gpHorizonCol, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locFadeRadius, &gpFadeRadius, SHADER_UNIFORM_FLOAT);
      SetShaderValue(groundPlaneShader, locSceneCenter, gpCenter, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPLightDir, &lightDirWS.x, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPLightColor, gpLightCol, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPCameraPos, gpCamPos, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPCleanMode, &gpCleanMode, SHADER_UNIFORM_FLOAT);
      float gpGridSpacing = static_cast<float>(currentDisplayScale * 1000.0);
      SetShaderValue(groundPlaneShader, locGPGridSpacing, &gpGridSpacing, SHADER_UNIFORM_FLOAT);

      // Pass shadow map to ground plane
      if (shadowsEnabled) {
        int gpShadowTexUnit = 3;
        SetShaderValue(groundPlaneShader, locGPShadowMap, &gpShadowTexUnit, SHADER_UNIFORM_INT);
        int gpShadowActive = 1;
        SetShaderValue(groundPlaneShader, locGPShadowsActive, &gpShadowActive, SHADER_UNIFORM_INT);
        SetShaderValueMatrix(groundPlaneShader, locGPLightSpaceMatrix, lightSpaceMatrix);
      } else {
        int gpShadowActive = 0;
        SetShaderValue(groundPlaneShader, locGPShadowsActive, &gpShadowActive, SHADER_UNIFORM_INT);
      }

      // Draw ground plane with alpha blending so edges fade into sky
      rlEnableColorBlend();
      rlSetBlendMode(RL_BLEND_ALPHA);
      if (shadowsEnabled) {
        rlActiveTextureSlot(3);
        rlEnableTexture(shadowMap.texture.id);
      }
      Matrix groundTransform = MatrixTranslate(centerX, minY - 0.002f, centerZ);
      DrawMesh(groundPlaneMesh, groundPlaneMat, groundTransform);
      if (shadowsEnabled) {
        rlActiveTextureSlot(3);
        rlDisableTexture();
        rlActiveTextureSlot(0);
      }
      rlSetBlendMode(RL_BLEND_ALPHA);
    } else if (!pbrModeEnabled && renderMode && !renderTransparentBg) {
      // Toon render mode: draw the same ground plane for consistent output
      float minY = cachedSceneBounds.min.y;
      float centerX = (cachedSceneBounds.min.x + cachedSceneBounds.max.x) * 0.5f;
      float centerZ = (cachedSceneBounds.min.z + cachedSceneBounds.max.z) * 0.5f;
      float gpGroundCol[3] = {0.85f, 0.83f, 0.80f};
      float gpHorizonCol[3] = {skyGroundCol[0], skyGroundCol[1], skyGroundCol[2]};
      float gpCleanMode = 0.6f;
      float gpFadeRadius = groundPlaneSize * 0.5f;
      float gpCenter[3] = {centerX, 0.0f, centerZ};
      float gpLightCol[3] = {1.0f, 0.95f, 0.9f};
      float gpCamPos[3] = {camera.position.x, camera.position.y, camera.position.z};
      float gpGridSpacing = static_cast<float>(currentDisplayScale * 1000.0);
      SetShaderValue(groundPlaneShader, locGroundColor, gpGroundCol, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locHorizonColor, gpHorizonCol, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locFadeRadius, &gpFadeRadius, SHADER_UNIFORM_FLOAT);
      SetShaderValue(groundPlaneShader, locSceneCenter, gpCenter, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPLightDir, &lightDirWS.x, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPLightColor, gpLightCol, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPCameraPos, gpCamPos, SHADER_UNIFORM_VEC3);
      SetShaderValue(groundPlaneShader, locGPCleanMode, &gpCleanMode, SHADER_UNIFORM_FLOAT);
      SetShaderValue(groundPlaneShader, locGPGridSpacing, &gpGridSpacing, SHADER_UNIFORM_FLOAT);
      if (shadowsEnabled) {
        int gpShadowTexUnit = 3;
        SetShaderValue(groundPlaneShader, locGPShadowMap, &gpShadowTexUnit, SHADER_UNIFORM_INT);
        int gpShadowActive = 1;
        SetShaderValue(groundPlaneShader, locGPShadowsActive, &gpShadowActive, SHADER_UNIFORM_INT);
        SetShaderValueMatrix(groundPlaneShader, locGPLightSpaceMatrix, lightSpaceMatrix);
      } else {
        int gpShadowActive = 0;
        SetShaderValue(groundPlaneShader, locGPShadowsActive, &gpShadowActive, SHADER_UNIFORM_INT);
      }
      rlEnableColorBlend();
      rlSetBlendMode(RL_BLEND_ALPHA);
      if (shadowsEnabled) {
        rlActiveTextureSlot(3);
        rlEnableTexture(shadowMap.texture.id);
      }
      Matrix groundTransform = MatrixTranslate(centerX, minY - 0.002f, centerZ);
      DrawMesh(groundPlaneMesh, groundPlaneMat, groundTransform);
      if (shadowsEnabled) {
        rlActiveTextureSlot(3);
        rlDisableTexture();
        rlActiveTextureSlot(0);
      }
      rlSetBlendMode(RL_BLEND_ALPHA);
    } else if (!renderMode) {
      DrawXZGrid(40, 0.5f, Fade(LIGHTGRAY, 0.4f));
      DrawAxes(2.0f);
    }

    // Determine which material ID to highlight (hover takes precedence)
    const std::string& highlightMatId = !uiState.hoveredMaterialId.empty()
        ? uiState.hoveredMaterialId
        : uiState.selectedMaterialId;

    // Outline pass - use bright highlight for hovered/selected material
    // Skip outlines in PBR mode for cleaner look (outlines are toon-style)
    if (!pbrModeEnabled) {
    rlDisableBackfaceCulling();
    for (size_t modelIdx = 0; modelIdx < models.size(); ++modelIdx) {
      const auto &modelWithColor = models[modelIdx];
      if (shouldSkipObject(modelWithColor)) {
        continue;
      }

      size_t objIdx = modelWithColor.sceneObjectIndex;

      // Check if this object should be highlighted
      bool shouldHighlight = !highlightMatId.empty() &&
                             modelWithColor.materialId == highlightMatId;

      // In assembly mode, highlight new parts
      bool isNewPart = uiState.showAssemblyPanel && assemblyNewSet.find(objIdx) != assemblyNewSet.end();

      if (shouldHighlight) {
        // Bright orange outline for highlighted objects
        setOutlineUniforms(outlineThickness * 2.5f, ORANGE);
      } else if (isNewPart) {
        // Green outline for new assembly parts
        setOutlineUniforms(outlineThickness * 2.0f, GREEN);
      } else {
        // Normal black outline
        setOutlineUniforms(outlineThickness, outlineColor);
      }

      for (int i = 0; i < modelWithColor.model.meshCount; ++i) {
        DrawMesh(modelWithColor.model.meshes[i], outlineMat, modelWithColor.model.transform);
      }
    }
    rlEnableBackfaceCulling();

    // Reset outline uniforms for consistency
    setOutlineUniforms(outlineThickness, outlineColor);
    } // end of !pbrModeEnabled outline pass

    if (pbrModeEnabled) {
      glEnable(GL_POLYGON_OFFSET_FILL);
      glPolygonOffset(1.0f, 1.0f);
    }

    // Bind shadow map to texture unit 3 once before the object loop
    if (shadowsEnabled) {
      rlActiveTextureSlot(3);
      rlEnableTexture(shadowMap.texture.id);
      rlActiveTextureSlot(0);
      if (!pbrModeEnabled) {
        const int toonShadowUnit = 3;
        SetShaderValue(toonShader, locToonShadowMap, &toonShadowUnit, SHADER_UNIFORM_INT);
        const int useShadowsVal = 1;
        SetShaderValue(toonShader, locToonUseShadows, &useShadowsVal, SHADER_UNIFORM_INT);
      }
    } else if (!pbrModeEnabled) {
      const int useShadowsVal = 0;
      SetShaderValue(toonShader, locToonUseShadows, &useShadowsVal, SHADER_UNIFORM_INT);
    }

    if (renderWireframe) {
      glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
      glLineWidth(1.0f);
    }

    // Main shading pass
    for (size_t modelIdx = 0; modelIdx < models.size(); ++modelIdx) {
      const auto &modelWithColor = models[modelIdx];
      if (shouldSkipObject(modelWithColor)) {
        continue;
      }

      size_t objIdx = modelWithColor.sceneObjectIndex;
      bool isNewPart = uiState.showAssemblyPanel && assemblyNewSet.find(objIdx) != assemblyNewSet.end();

      // Use thermal color if thermal view is enabled and material has thermal data
      Color renderColor = modelWithColor.color;
      if (uiState.thermalViewEnabled && !modelWithColor.materialId.empty()) {
        auto it = thermalColorByMaterial.find(modelWithColor.materialId);
        if (it != thermalColorByMaterial.end()) {
          renderColor = it->second;
        }
      }

      // In assembly mode: new parts are bright, old parts are faded
      float alpha = 1.0f;
      if (uiState.showAssemblyPanel && !assemblyVisibleSet.empty()) {
        if (isNewPart) {
          // Brighten new parts slightly
          renderColor.r = std::min(255, renderColor.r + 30);
          renderColor.g = std::min(255, renderColor.g + 30);
          renderColor.b = std::min(255, renderColor.b + 30);
        } else {
          // Fade old parts
          alpha = 0.4f;
        }
      }

      const float modelColor[4] = {
        renderColor.r / 255.0f,
        renderColor.g / 255.0f,
        renderColor.b / 255.0f,
        alpha
      };

      // Get material texture or use fallback
      Texture2D* materialTex = nullptr;
      if (!modelWithColor.materialId.empty()) {
        materialTex = g_materialLibrary.getTexture(modelWithColor.materialId);
      }
      int useTex = (materialTex && materialTex->id != 0) ? 1 : 0;

      if (pbrModeEnabled) {
        float matRoughness = 0.5f;
        float matMetallic = 0.0f;
        float matAo = 1.0f;

        if (!modelWithColor.materialId.empty()) {
          const PBRMaterial* mat = g_materialLibrary.get(modelWithColor.materialId);
          if (mat) {
            matRoughness = mat->visual.roughness;
            matMetallic = mat->visual.metallic;
          }
        }
        if (modelWithColor.roughness >= 0.0f) matRoughness = modelWithColor.roughness;
        if (modelWithColor.metallic >= 0.0f) matMetallic = modelWithColor.metallic;

        if (shadowsEnabled) {
          // PBR with shadows rendering path
          SetShaderValue(pbrShadowShader, locPbrShadowAlbedoColor, modelColor, SHADER_UNIFORM_VEC4);
          SetShaderValue(pbrShadowShader, locPbrShadowUseAlbedoTex, &useTex, SHADER_UNIFORM_INT);
          SetShaderValue(pbrShadowShader, locPbrShadowRoughness, &matRoughness, SHADER_UNIFORM_FLOAT);
          SetShaderValue(pbrShadowShader, locPbrShadowMetallic, &matMetallic, SHADER_UNIFORM_FLOAT);
          SetShaderValue(pbrShadowShader, locPbrShadowAo, &matAo, SHADER_UNIFORM_FLOAT);

          pbrShadowMat.maps[MATERIAL_MAP_DIFFUSE].texture =
            (materialTex && materialTex->id != 0) ? *materialTex : fallbackTexture;

          for (int i = 0; i < modelWithColor.model.meshCount; ++i) {
            DrawMesh(modelWithColor.model.meshes[i], pbrShadowMat, modelWithColor.model.transform);
          }
        } else {
          // PBR without shadows (fallback)
          SetShaderValue(pbrShader, locPbrAlbedoColor, modelColor, SHADER_UNIFORM_VEC4);
          SetShaderValue(pbrShader, locPbrUseAlbedoTex, &useTex, SHADER_UNIFORM_INT);
          SetShaderValue(pbrShader, locPbrRoughness, &matRoughness, SHADER_UNIFORM_FLOAT);
          SetShaderValue(pbrShader, locPbrMetallic, &matMetallic, SHADER_UNIFORM_FLOAT);
          SetShaderValue(pbrShader, locPbrAo, &matAo, SHADER_UNIFORM_FLOAT);

          pbrMat.maps[MATERIAL_MAP_DIFFUSE].texture =
            (materialTex && materialTex->id != 0) ? *materialTex : fallbackTexture;

          for (int i = 0; i < modelWithColor.model.meshCount; ++i) {
            DrawMesh(modelWithColor.model.meshes[i], pbrMat, modelWithColor.model.transform);
          }
        }
      } else {
        // Toon rendering path (original)
        SetShaderValue(toonShader, locBaseColor, modelColor, SHADER_UNIFORM_VEC4);
        SetShaderValue(toonShader, locUseTexture, &useTex, SHADER_UNIFORM_INT);

        toonMat.maps[MATERIAL_MAP_DIFFUSE].texture =
          (materialTex && materialTex->id != 0) ? *materialTex : fallbackTexture;

        for (int i = 0; i < modelWithColor.model.meshCount; ++i) {
          DrawMesh(modelWithColor.model.meshes[i], toonMat, modelWithColor.model.transform);
        }
      }
    }

    if (renderWireframe) {
      glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
    }

    // Unbind shadow map from unit 3 after the object loop
    if (shadowsEnabled) {
      rlActiveTextureSlot(3);
      rlDisableTexture();
      rlActiveTextureSlot(0);
    }

    if (pbrModeEnabled) {
      glDisable(GL_POLYGON_OFFSET_FILL);
    }

    EndMode3D();
    EndTextureMode();

    // Render normal/depth buffer
    // Clear with alpha=255 (far depth) so background appears as "far away" for SSAO
    BeginTextureMode(rtNormalDepth);
    ClearBackground({127, 127, 255, 255});
    rlDisableColorBlend();  // Disable blending so alpha (depth) is written correctly
    BeginMode3D(camera);
    for (const auto &modelWithColor : models) {
      if (shouldSkipObject(modelWithColor)) continue;
      for (int i = 0; i < modelWithColor.model.meshCount; ++i) {
        DrawMesh(modelWithColor.model.meshes[i], normalDepthMat, modelWithColor.model.transform);
      }
    }
    EndMode3D();
    rlEnableColorBlend();  // Re-enable blending for subsequent draws
    EndTextureMode();

    // ============ SSAO Pass ============
    // Render raw SSAO using normal/depth buffer
    BeginTextureMode(rtSSAORaw);
    ClearBackground(WHITE);  // White = no occlusion

    // Set SSAO uniforms
    const float ssaoTexelSize[2] = {
        1.0f / static_cast<float>(rtNormalDepth.texture.width),
        1.0f / static_cast<float>(rtNormalDepth.texture.height)
    };
    SetShaderValue(ssaoShader, locSSAOTexelSize, ssaoTexelSize, SHADER_UNIFORM_VEC2);
    const float ssaoRadius = 0.3f;   // Sample radius in normalized depth space
    const float ssaoIntensity = 1.0f; // Occlusion intensity multiplier (reduced to avoid overly dark)
    SetShaderValue(ssaoShader, locSSAORadius, &ssaoRadius, SHADER_UNIFORM_FLOAT);
    SetShaderValue(ssaoShader, locSSAOIntensity, &ssaoIntensity, SHADER_UNIFORM_FLOAT);
    SetShaderValue(ssaoShader, locSSAOZNear, &zNear, SHADER_UNIFORM_FLOAT);
    SetShaderValue(ssaoShader, locSSAOZFar, &zFar, SHADER_UNIFORM_FLOAT);

    BeginShaderMode(ssaoShader);
    // Draw fullscreen quad - texture0 is auto-bound
    const Rectangle ssaoSrcRect = {0.0f, 0.0f,
        static_cast<float>(rtNormalDepth.texture.width),
        -static_cast<float>(rtNormalDepth.texture.height)};
    DrawTextureRec(rtNormalDepth.texture, ssaoSrcRect, {0.0f, 0.0f}, WHITE);
    EndShaderMode();
    EndTextureMode();

    // ============ SSAO Blur Pass ============
    // Blur the raw SSAO to remove noise
    BeginTextureMode(rtSSAOBlur);
    ClearBackground(WHITE);

    const float ssaoBlurTexelSize[2] = {
        1.0f / static_cast<float>(rtSSAORaw.texture.width),
        1.0f / static_cast<float>(rtSSAORaw.texture.height)
    };
    SetShaderValue(ssaoBlurShader, locSSAOBlurTexelSize, ssaoBlurTexelSize, SHADER_UNIFORM_VEC2);
    SetShaderValueTexture(ssaoBlurShader, locSSAOBlurNDTex, rtNormalDepth.texture);

    BeginShaderMode(ssaoBlurShader);
    const Rectangle blurSrcRect = {0.0f, 0.0f,
        static_cast<float>(rtSSAORaw.texture.width),
        -static_cast<float>(rtSSAORaw.texture.height)};
    DrawTextureRec(rtSSAORaw.texture, blurSrcRect, {0.0f, 0.0f}, WHITE);
    EndShaderMode();
    EndTextureMode();

    // Rebind normal/depth texture in case texture slots were modified by per-object bindings
    SetShaderValueTexture(edgeShader, locNormDepthTexture, rtNormalDepth.texture);
    // Bind SSAO texture and set strength for final composite
    SetShaderValueTexture(edgeShader, locEdgeSSAOTex, rtSSAOBlur.texture);
    const float ssaoStrength = renderWhiteBackground ? 0.0f : (pbrModeEnabled ? 0.35f : 0.25f);
    SetShaderValue(edgeShader, locEdgeSSAOStrength, &ssaoStrength, SHADER_UNIFORM_FLOAT);

    // Final composite
    BeginDrawing();
    ClearBackground(RAYWHITE);

    const float texel[2] = {
        1.0f / static_cast<float>(rtNormalDepth.texture.width),
        1.0f / static_cast<float>(rtNormalDepth.texture.height)};
    SetShaderValue(edgeShader, locTexel, texel, SHADER_UNIFORM_VEC2);

    const Rectangle srcRect = {0.0f, 0.0f, static_cast<float>(rtColor.texture.width),
                               -static_cast<float>(rtColor.texture.height)};
    const Rectangle screenDstRect = {0.0f, 0.0f,
                                     static_cast<float>(screenWidth),
                                     static_cast<float>(screenHeight)};

    if (debugViewMode == 1) {
      // Raw mode - show pure 3D render without any post-processing
      DrawTexturePro(rtColor.texture, srcRect, screenDstRect, {0.0f, 0.0f}, 0.0f, WHITE);
    } else if (debugViewMode >= 2 && debugViewMode <= 4) {
      // Debug visualization mode - texture0 is auto-bound by DrawTextureRec
      int shaderDebugMode = debugViewMode - 2;  // 0=depth, 1=normals, 2=combined
      SetShaderValue(debugShader, locDebugMode, &shaderDebugMode, SHADER_UNIFORM_INT);
      BeginShaderMode(debugShader);
      DrawTexturePro(rtNormalDepth.texture, srcRect, screenDstRect, {0.0f, 0.0f}, 0.0f, WHITE);
      EndShaderMode();
    } else if (debugViewMode == 5) {
      // SSAO debug view - show raw SSAO buffer
      DrawTexturePro(rtSSAORaw.texture, srcRect, screenDstRect, {0.0f, 0.0f}, 0.0f, WHITE);
    } else if (debugViewMode == 6) {
      // SSAO blurred debug view
      DrawTexturePro(rtSSAOBlur.texture, srcRect, screenDstRect, {0.0f, 0.0f}, 0.0f, WHITE);
    } else {
      // Normal rendering (mode 0) with edge detection, SSAO, and FXAA
      // Step 1: Apply edge shader and downsample to rtFXAA (screen resolution)
      BeginTextureMode(rtFXAA);
      ClearBackground(renderTransparentBg ? BLANK : BLACK);
      BeginShaderMode(edgeShader);
      // Downsample from supersampled buffer to screen resolution
      // Negative height in source rect flips Y (raylib render texture convention)
      const Rectangle ssSrcRect = {0.0f, 0.0f, static_cast<float>(rtColor.texture.width),
                                   -static_cast<float>(rtColor.texture.height)};
      const Rectangle dstRect = {0.0f, 0.0f, static_cast<float>(rtFXAA.texture.width),
                                 static_cast<float>(rtFXAA.texture.height)};
      DrawTexturePro(rtColor.texture, ssSrcRect, dstRect, {0.0f, 0.0f}, 0.0f, WHITE);
      EndShaderMode();
      EndTextureMode();

      // Step 2: Apply FXAA and draw to screen
      const float fxaaTexel[2] = {
          1.0f / static_cast<float>(rtFXAA.texture.width),
          1.0f / static_cast<float>(rtFXAA.texture.height)};
      SetShaderValue(fxaaShader, locFXAATexelSize, fxaaTexel, SHADER_UNIFORM_VEC2);
      float fxaaAlphaMode = renderTransparentBg ? 1.0f : 0.0f;
      SetShaderValue(fxaaShader, locFXAAPreserveAlpha, &fxaaAlphaMode, SHADER_UNIFORM_FLOAT);
      float fxaaSkipVignette = renderWhiteBackground ? 1.0f : 0.0f;
      SetShaderValue(fxaaShader, locFXAASkipVignette, &fxaaSkipVignette, SHADER_UNIFORM_FLOAT);
      BeginShaderMode(fxaaShader);
      const Rectangle fxaaSrcRect = {0.0f, 0.0f, static_cast<float>(rtFXAA.texture.width),
                                     -static_cast<float>(rtFXAA.texture.height)};
      DrawTexturePro(rtFXAA.texture, fxaaSrcRect, screenDstRect, {0.0f, 0.0f}, 0.0f, WHITE);
      EndShaderMode();
    }

    if (!renderMode || renderShowUI) {
      // Draw branding in toolbar area (scene name or fallback)
      const float margin = 15.0f;
      const Vector2 brandPos = {margin, 4.0f};
      const Vector2 brandSize = MeasureTextEx(brandingFont, brandText.c_str(), kBrandFontSize, 0.0f);

      // Draw toolbar at top (includes panel toggles and status)
      DrawToolbar(uiState, uiFont, screenWidth, statusMessage, margin + brandSize.x);
      DrawTextEx(brandingFont, brandText.c_str(), brandPos, kBrandFontSize, 0.0f, WHITE);

      // Draw UI panels (positioned below toolbar)
      if (uiState.showMaterialsPanel) {
        // When assembly panel is active, filter materials to show only materials visible in current step
        std::vector<std::string> assemblyMaterialFilter;
        if (uiState.showAssemblyPanel && !assemblyInstructions.steps.empty()) {
          int stepIdx = std::clamp(uiState.currentAssemblyStep, 0,
                                   static_cast<int>(assemblyInstructions.steps.size()) - 1);
          const auto& currentStep = assemblyInstructions.steps[stepIdx];

          // Collect materials from visible objects in this step
          std::set<std::string> visibleMaterials;

          // If step uses showObjects, get materials from those object indices
          if (!currentStep.objectIndices.empty()) {
            for (size_t objIdx : currentStep.objectIndices) {
              if (objIdx < sceneData.objects.size()) {
                const auto& obj = sceneData.objects[objIdx];
                if (!obj.materialId.empty()) {
                  visibleMaterials.insert(obj.materialId);
                }
              }
            }
          }

          // Also include explicitly listed showMaterials (for steps that use material-based filtering)
          for (const auto& mat : currentStep.showMaterials) {
            visibleMaterials.insert(mat);
          }

          // Convert set to vector for the filter
          for (const auto& mat : visibleMaterials) {
            assemblyMaterialFilter.push_back(mat);
          }
        }
        DrawMaterialsPanel(sceneMaterials, uiState, uiFont, screenWidth, screenHeight, assemblyMaterialFilter);
      }

      if (uiState.showParametersPanel) {
        bool paramWritten = DrawParametersPanel(sceneParameters, uiState, uiFont,
                                                screenWidth, screenHeight, scriptPath);
        if (paramWritten && uiState.liveUpdatesEnabled) {
          startBackgroundLoad();
        }
      }

      // Thermal view UI
      if (uiState.thermalViewEnabled) {
        if (uiState.showThermalPanel) {
          if (DrawThermalPanel(thermalResult, uiState, uiFont, screenWidth, screenHeight)) {
            // Thermal settings changed - trigger recalculation
            thermalResultDirty = true;
          }
        }
        DrawThermalLegend(thermalResult.minHeatFlux, thermalResult.maxHeatFlux,
                          uiFont, screenWidth, screenHeight);
      }

      // Draw structural panel
      if (uiState.showStructuralPanel) {
        DrawStructuralPanel(structuralResult, uiState, uiFont, screenWidth, screenHeight);
      }

      // Draw assembly preview panel
      if (uiState.showAssemblyPanel) {
        DrawAssemblyPanel(assemblyInstructions, uiState, uiFont, screenWidth, screenHeight);
      }
    }

    EndDrawing();

    // Screenshot for render mode
    if (renderMode && !screenshotTaken && frameCount >= std::max(renderCaptureFrame, 1)) {
      Image screenImage;
      if (renderTransparentBg) {
        screenImage = LoadImageFromTexture(rtFXAA.texture);
        ImageFlipVertical(&screenImage);
      } else {
        screenImage = LoadImageFromScreen();
      }
      if (screenImage.width != renderWidth || screenImage.height != renderHeight) {
        ImageResize(&screenImage, renderWidth, renderHeight);
      }

      if (turntableFrames > 0) {
        auto basePath = std::filesystem::absolute(renderOutputPath);
        auto stem = basePath.stem().string();
        auto ext = basePath.extension().string();
        auto dir = basePath.parent_path();
        char frameName[256];
        snprintf(frameName, sizeof(frameName), "%s_%04d%s", stem.c_str(), turntableIndex, ext.c_str());
        auto framePath = dir / frameName;
        ExportImage(screenImage, framePath.string().c_str());
        UnloadImage(screenImage);

        turntableIndex++;
        if (turntableIndex >= turntableFrames) {
          std::cout << "Turntable complete: " << turntableFrames << " frames in " << dir.string() << std::endl;
          screenshotTaken = true;
          break;
        }

        // Advance yaw for next frame
        orbitYaw = turntableBaseYaw + (2.0f * PI * turntableIndex / turntableFrames);
        camera.position = Vector3Add(camera.target, {
          orbitDistance * cosf(orbitPitch) * sinf(orbitYaw),
          orbitDistance * sinf(orbitPitch),
          orbitDistance * cosf(orbitPitch) * cosf(orbitYaw)
        });
        frameCount = 0;
      } else {
        auto absOutputPath = std::filesystem::absolute(renderOutputPath);
        ExportImage(screenImage, absOutputPath.string().c_str());
        UnloadImage(screenImage);
        TraceLog(LOG_INFO, "Rendered to: %s", absOutputPath.string().c_str());
        std::cout << "Rendered to: " << absOutputPath.string() << std::endl;
        screenshotTaken = true;
        break;
      }
    }
  }

  // Restore CLI param overrides so scene file is unchanged
  if (!originalParamValues.empty()) {
    refreshParameters();
    for (const auto& [name, origValue] : originalParamValues) {
      for (auto& param : sceneParameters) {
        if (param.name == name) {
          param.value = origValue;
          WriteParameterToFile(scriptPath, param);
          break;
        }
      }
    }
  }

  // In one-shot render mode we can exit after screenshot without full manual teardown.
  // Some explicit shader/material unload combinations currently trip driver/raylib shutdown.
  if (renderMode) {
    DestroyModels(models);
    if (brandingFontCustom) UnloadFont(brandingFont);
    if (uiFontCustom) UnloadFont(uiFont);
    JS_FreeRuntime(runtime);
    CloseWindow();
    return 0;
  }

  // Cleanup
  UnloadMaterialTextures();
  UnloadTexture(fallbackTexture);
  UnloadRenderTexture(rtColor);
  UnloadRenderTexture(rtNormalDepth);
  UnloadRenderTexture(rtSSAORaw);
  UnloadRenderTexture(rtSSAOBlur);
  UnloadRenderTexture(rtFXAA);
  if (shadowsEnabled) {
    UnloadRenderTexture(shadowMap);
    UnloadMaterial(pbrShadowMat);
    UnloadMaterial(shadowDepthMat);
    UnloadShader(pbrShadowShader);
    UnloadShader(shadowDepthShader);
  }
  UnloadMaterial(toonMat);
  UnloadMaterial(pbrMat);
  UnloadMaterial(normalDepthMat);
  UnloadMaterial(outlineMat);
  UnloadMaterial(groundPlaneMat);
  UnloadMaterial(skyMat);
  UnloadShader(toonShader);
  UnloadShader(pbrShader);
  UnloadShader(normalDepthShader);
  UnloadShader(outlineShader);
  UnloadShader(groundPlaneShader);
  UnloadShader(skyShader);
  UnloadShader(edgeShader);
  UnloadShader(ssaoShader);
  UnloadShader(ssaoBlurShader);
  UnloadShader(fxaaShader);
  UnloadShader(debugShader);
  UnloadMesh(groundPlaneMesh);
  UnloadMesh(skyQuad);
  DestroyModels(models);
  if (brandingFontCustom) UnloadFont(brandingFont);
  if (uiFontCustom) UnloadFont(uiFont);
  JS_FreeRuntime(runtime);
  CloseWindow();

  return 0;
}

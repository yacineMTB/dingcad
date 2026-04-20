#include "scene_loader.h"
#include "file_utils.h"
#include "js_bindings.h"
#include "material_loader.h"
#include "thermal_area.h"

#include "raymath.h"

#include <chrono>
#include <cstdlib>
#include <future>
#include <iostream>

namespace helscoop {

// Replace home directory with ~ for privacy in displayed paths
static std::string shortenHomePath(const std::string& path) {
  const char* home = std::getenv("HOME");
  if (home && path.find(home) == 0) {
    return "~" + path.substr(std::strlen(home));
  }
  return path;
}

ModuleLoaderData g_moduleLoaderData;

JSModuleDef* FilesystemModuleLoader(JSContext* ctx, const char* module_name, void* opaque) {
  auto* data = static_cast<ModuleLoaderData*>(opaque);
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

  auto* module = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(funcVal));
  JS_FreeValue(ctx, funcVal);
  return module;
}

LoadResult LoadSceneFromFile(JSRuntime* runtime,
                             const std::filesystem::path& path,
                             ModuleLoaderData* loaderData) {
  auto loadStart = std::chrono::high_resolution_clock::now();

  ModuleLoaderData* data = loaderData ? loaderData : &g_moduleLoaderData;

  LoadResult result;
  const auto absolutePath = std::filesystem::absolute(path);
  if (!std::filesystem::exists(absolutePath)) {
    result.message = "Scene file not found: " + absolutePath.string();
    return result;
  }
  data->baseDir = absolutePath.parent_path();
  data->dependencies.clear();
  data->dependencies.insert(absolutePath);
  auto sourceOpt = ReadTextFile(absolutePath);
  if (!sourceOpt) {
    result.message = "Unable to read scene file: " + absolutePath.string();
    result.dependencies.assign(data->dependencies.begin(), data->dependencies.end());
    return result;
  }

  auto afterRead = std::chrono::high_resolution_clock::now();

  JSContext* ctx = JS_NewContext(runtime);
  if (!ctx) {
    result.message = "Failed to create JS context (out of memory)";
    return result;
  }
  RegisterBindings(ctx);

  auto afterBindings = std::chrono::high_resolution_clock::now();

  auto captureException = [&]() {
    JSValue exc = JS_GetException(ctx);
    // Try to get a meaningful error: message property, then string conversion, then stack
    std::string errMsg;
    JSValue msgVal = JS_GetPropertyStr(ctx, exc, "message");
    if (!JS_IsUndefined(msgVal)) {
      const char* msgStr = JS_ToCString(ctx, msgVal);
      if (msgStr && msgStr[0]) errMsg = msgStr;
      JS_FreeCString(ctx, msgStr);
    }
    JS_FreeValue(ctx, msgVal);
    if (errMsg.empty()) {
      const char* excStr = JS_ToCString(ctx, exc);
      if (excStr && excStr[0]) errMsg = excStr;
      JS_FreeCString(ctx, excStr);
    }
    JSValue stack = JS_GetPropertyStr(ctx, exc, "stack");
    if (!JS_IsUndefined(stack)) {
      const char* stackStr = JS_ToCString(ctx, stack);
      if (stackStr && stackStr[0]) {
        if (!errMsg.empty()) errMsg += "\n";
        errMsg += stackStr;
      }
      JS_FreeCString(ctx, stackStr);
    }
    JS_FreeValue(ctx, stack);
    JS_FreeValue(ctx, exc);
    result.message = errMsg.empty() ? "JavaScript error (no details available)" : errMsg;
  };
  auto assignDependencies = [&]() {
    result.dependencies.assign(data->dependencies.begin(), data->dependencies.end());
  };

  JSValue moduleFunc = JS_Eval(ctx, sourceOpt->c_str(), sourceOpt->size(),
                               absolutePath.string().c_str(),
                               JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(moduleFunc)) {
    captureException();
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }

  auto afterCompile = std::chrono::high_resolution_clock::now();

  if (JS_ResolveModule(ctx, moduleFunc) < 0) {
    captureException();
    JS_FreeValue(ctx, moduleFunc);
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }

  auto afterResolve = std::chrono::high_resolution_clock::now();

  auto* module = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(moduleFunc));
  JSValue evalResult = JS_EvalFunction(ctx, moduleFunc);
  if (JS_IsException(evalResult)) {
    captureException();
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }
  JS_FreeValue(ctx, evalResult);

  auto afterEval = std::chrono::high_resolution_clock::now();

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
    if (result.message.find("not initialized") != std::string::npos) {
      result.message = "Scene threw an error during evaluation (exports never assigned)";
    }
    assignDependencies();
    JS_FreeContext(ctx);
    return result;
  }
  // Check for uninitialized exports (module threw before const was assigned)
  if (!JS_IsUndefined(sceneVal) && !JS_IsObject(sceneVal) && !JS_IsArray(sceneVal)) {
    const char* valStr = JS_ToCString(ctx, sceneVal);
    std::string valRepr = valStr ? valStr : "(unknown)";
    JS_FreeCString(ctx, valStr);
    if (valRepr == "[uninitialized]" || valRepr.find("not initialized") != std::string::npos) {
      JS_FreeValue(ctx, sceneVal);
      JS_FreeValue(ctx, moduleNamespace);
      result.message = "Scene threw an error during evaluation (exports never assigned)";
      assignDependencies();
      JS_FreeContext(ctx);
      return result;
    }
  }

  JSValue materialsVal = JS_GetPropertyStr(ctx, moduleNamespace, "materials");
  JSValue displayScaleVal = JS_GetPropertyStr(ctx, moduleNamespace, "displayScale");
  JSValue assemblyVal = JS_GetPropertyStr(ctx, moduleNamespace, "buildGuide");

  JS_FreeValue(ctx, moduleNamespace);

  // Parse display scale for surface area calculation (default 1.0 if not provided)
  double displayScale = 1.0;
  if (!JS_IsUndefined(displayScaleVal)) {
    double val;
    if (JS_ToFloat64(ctx, &val, displayScaleVal) == 0 && val > 0) {
      displayScale = val;
      result.displayScale = val;
      TraceLog(LOG_INFO, "SCALE: Read displayScale from scene: %f", displayScale);
    }
  } else {
    TraceLog(LOG_WARNING, "SCALE: displayScale not exported, using default 1.0");
  }
  JS_FreeValue(ctx, displayScaleVal);

  if (JS_IsUndefined(sceneVal)) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeValue(ctx, materialsVal);
    JS_FreeValue(ctx, assemblyVal);
    JS_FreeContext(ctx);
    result.message = "Scene module must export 'scene'";
    assignDependencies();
    return result;
  }

  auto parseColoredObject = [&](JSValue objVal) -> std::optional<ColoredObject> {
    // Case 1: Raw manifold geometry
    auto manifoldHandle = GetManifoldHandle(ctx, objVal);
    if (manifoldHandle) {
      return ColoredObject{manifoldHandle, kBaseColor, "", "", 1};
    }

    // Case 2: Object with geometry property
    JSValue geomVal = JS_GetPropertyStr(ctx, objVal, "geometry");
    if (JS_IsUndefined(geomVal)) {
      JS_FreeValue(ctx, geomVal);
      return std::nullopt;
    }

    auto geom = GetManifoldHandle(ctx, geomVal);
    JS_FreeValue(ctx, geomVal);
    if (!geom) {
      return std::nullopt;
    }

    Color color = kBaseColor;
    std::string materialId;
    int quantity = 1;

    // Check for material reference (string)
    JSValue materialVal = JS_GetPropertyStr(ctx, objVal, "material");
    if (!JS_IsUndefined(materialVal) && JS_IsString(materialVal)) {
      const char* matIdStr = JS_ToCString(ctx, materialVal);
      if (matIdStr) {
        materialId = matIdStr;
        TraceLog(LOG_INFO, "SCENE-LOAD: Parsed object with material='%s'", matIdStr);
        // Look up in material library for color
        const PBRMaterial* mat = g_materialLibrary.get(materialId);
        if (mat) {
          color = mat->visual.toColor();
        }
        JS_FreeCString(ctx, matIdStr);
      }
    }
    JS_FreeValue(ctx, materialVal);

    // Check for explicit color (overrides material color)
    JSValue colorVal = JS_GetPropertyStr(ctx, objVal, "color");
    if (!JS_IsUndefined(colorVal) && JS_IsArray(colorVal)) {
      std::array<double, 3> colorArray{};
      bool colorOk = true;

      for (uint32_t i = 0; i < 3; ++i) {
        JSValue element = JS_GetPropertyUint32(ctx, colorVal, i);
        if (JS_ToFloat64(ctx, &colorArray[i], element) < 0) {
          colorOk = false;
          JS_FreeValue(ctx, element);
          break;
        }
        JS_FreeValue(ctx, element);
      }

      if (colorOk) {
        color = {
          static_cast<unsigned char>(Clamp(colorArray[0] * 255.0, 0.0, 255.0)),
          static_cast<unsigned char>(Clamp(colorArray[1] * 255.0, 0.0, 255.0)),
          static_cast<unsigned char>(Clamp(colorArray[2] * 255.0, 0.0, 255.0)),
          255
        };
      }
    }
    JS_FreeValue(ctx, colorVal);

    // Check for quantity
    JSValue quantityVal = JS_GetPropertyStr(ctx, objVal, "quantity");
    if (!JS_IsUndefined(quantityVal)) {
      int32_t q = 1;
      JS_ToInt32(ctx, &q, quantityVal);
      quantity = q;
    }
    JS_FreeValue(ctx, quantityVal);

    // Check for objectId (for assembly step filtering)
    std::string objectId;
    JSValue objectIdVal = JS_GetPropertyStr(ctx, objVal, "objectId");
    if (!JS_IsUndefined(objectIdVal) && JS_IsString(objectIdVal)) {
      const char* objIdStr = JS_ToCString(ctx, objectIdVal);
      if (objIdStr) {
        objectId = objIdStr;
        JS_FreeCString(ctx, objIdStr);
      }
    }
    JS_FreeValue(ctx, objectIdVal);

    // Check for assemblyOnly flag (only visible in assembly mode)
    bool assemblyOnly = false;
    JSValue assemblyOnlyVal = JS_GetPropertyStr(ctx, objVal, "assemblyOnly");
    if (!JS_IsUndefined(assemblyOnlyVal) && JS_IsBool(assemblyOnlyVal)) {
      assemblyOnly = JS_ToBool(ctx, assemblyOnlyVal);
    }
    JS_FreeValue(ctx, assemblyOnlyVal);

    // Check for PBR overrides (roughness, metallic)
    float roughness = -1.0f;
    float metallic = -1.0f;
    JSValue roughnessVal = JS_GetPropertyStr(ctx, objVal, "roughness");
    if (!JS_IsUndefined(roughnessVal)) {
      double r = 0.0;
      if (JS_ToFloat64(ctx, &r, roughnessVal) == 0) roughness = static_cast<float>(r);
    }
    JS_FreeValue(ctx, roughnessVal);
    JSValue metallicVal = JS_GetPropertyStr(ctx, objVal, "metallic");
    if (!JS_IsUndefined(metallicVal)) {
      double m = 0.0;
      if (JS_ToFloat64(ctx, &m, metallicVal) == 0) metallic = static_cast<float>(m);
    }
    JS_FreeValue(ctx, metallicVal);

    return ColoredObject{geom, color, materialId, objectId, quantity, assemblyOnly, roughness, metallic};
  };

  if (JS_IsArray(sceneVal)) {
    JSValue lengthVal = JS_GetPropertyStr(ctx, sceneVal, "length");
    uint32_t length = 0;
    if (JS_ToUint32(ctx, &length, lengthVal) < 0) {
      JS_FreeValue(ctx, lengthVal);
      JS_FreeValue(ctx, sceneVal);
      JS_FreeValue(ctx, materialsVal);
      JS_FreeValue(ctx, assemblyVal);
      JS_FreeContext(ctx);
      result.message = "Failed to get scene array length";
      assignDependencies();
      return result;
    }
    JS_FreeValue(ctx, lengthVal);

    for (uint32_t i = 0; i < length; ++i) {
      JSValue itemVal = JS_GetPropertyUint32(ctx, sceneVal, i);
      auto obj = parseColoredObject(itemVal);
      JS_FreeValue(ctx, itemVal);

      if (obj) {
        result.sceneData.objects.push_back(*obj);
      } else {
        JS_FreeValue(ctx, sceneVal);
        JS_FreeValue(ctx, materialsVal);
        JS_FreeValue(ctx, assemblyVal);
        JS_FreeContext(ctx);
        result.message = "Scene array element " + std::to_string(i) + " is not a manifold or colored object";
        assignDependencies();
        return result;
      }
    }
  } else {
    auto obj = parseColoredObject(sceneVal);
    if (obj) {
      result.sceneData.objects.push_back(*obj);
    } else {
      JS_FreeValue(ctx, sceneVal);
      JS_FreeValue(ctx, materialsVal);
      JS_FreeValue(ctx, assemblyVal);
      JS_FreeContext(ctx);
      result.message = "Exported 'scene' is not a manifold or colored object";
      assignDependencies();
      return result;
    }
  }

  if (result.sceneData.objects.empty()) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeValue(ctx, materialsVal);
    JS_FreeValue(ctx, assemblyVal);
    JS_FreeContext(ctx);
    result.message = "Scene is empty";
    assignDependencies();
    return result;
  }

  // Parse materials array from JS
  if (!JS_IsUndefined(materialsVal) && !JS_IsException(materialsVal) && JS_IsArray(materialsVal)) {
    JSValue matLengthVal = JS_GetPropertyStr(ctx, materialsVal, "length");
    uint32_t matLength = 0;
    if (JS_ToUint32(ctx, &matLength, matLengthVal) >= 0) {
      for (uint32_t i = 0; i < matLength; ++i) {
        JSValue itemVal = JS_GetPropertyUint32(ctx, materialsVal, i);
        MaterialItem item;

        JSValue nameVal = JS_GetPropertyStr(ctx, itemVal, "name");
        if (!JS_IsUndefined(nameVal)) {
          const char* str = JS_ToCString(ctx, nameVal);
          if (str) { item.name = str; JS_FreeCString(ctx, str); }
        }
        JS_FreeValue(ctx, nameVal);

        JSValue catVal = JS_GetPropertyStr(ctx, itemVal, "category");
        if (!JS_IsUndefined(catVal)) {
          const char* str = JS_ToCString(ctx, catVal);
          if (str) { item.category = str; JS_FreeCString(ctx, str); }
        }
        JS_FreeValue(ctx, catVal);

        JSValue linkVal = JS_GetPropertyStr(ctx, itemVal, "link");
        if (!JS_IsUndefined(linkVal)) {
          const char* str = JS_ToCString(ctx, linkVal);
          if (str) { item.link = str; JS_FreeCString(ctx, str); }
        }
        JS_FreeValue(ctx, linkVal);

        JSValue unitVal = JS_GetPropertyStr(ctx, itemVal, "unit");
        if (!JS_IsUndefined(unitVal)) {
          const char* str = JS_ToCString(ctx, unitVal);
          if (str) { item.unit = str; JS_FreeCString(ctx, str); }
        }
        JS_FreeValue(ctx, unitVal);

        JSValue priceVal = JS_GetPropertyStr(ctx, itemVal, "unitPrice");
        if (!JS_IsUndefined(priceVal)) {
          double val = 0;
          if (JS_ToFloat64(ctx, &val, priceVal) >= 0) {
            item.unitPrice = static_cast<float>(val);
          }
        }
        JS_FreeValue(ctx, priceVal);

        JSValue qtyVal = JS_GetPropertyStr(ctx, itemVal, "quantity");
        if (!JS_IsUndefined(qtyVal)) {
          int32_t val = 0;
          if (JS_ToInt32(ctx, &val, qtyVal) >= 0) {
            item.quantity = val;
          }
        }
        JS_FreeValue(ctx, qtyVal);

        // Parse materialId for matching with scene objects
        JSValue matIdVal = JS_GetPropertyStr(ctx, itemVal, "materialId");
        if (!JS_IsUndefined(matIdVal)) {
          const char* str = JS_ToCString(ctx, matIdVal);
          if (str) {
            item.materialId = str;
            // Look up color from material library
            const PBRMaterial* mat = g_materialLibrary.get(item.materialId);
            if (mat) {
              item.color = mat->visual.toColor();
            }
            JS_FreeCString(ctx, str);
          }
        }
        JS_FreeValue(ctx, matIdVal);

        JS_FreeValue(ctx, itemVal);

        if (!item.name.empty()) {
          result.materials.push_back(item);
        }
      }
    }
    JS_FreeValue(ctx, matLengthVal);
  }

  // Calculate surface area per materialId from scene geometry
  // First, build a map of materialId -> total surface area
  // Note: Geometry is scaled by displayScale for rendering, so surface area is
  // scaled by displayScale². We need to undo this to get the original mm² area.
  //
  // IMPORTANT: For thermal calculations, we need the PROJECTED area perpendicular
  // to heat flow, not the full 3D mesh surface area. For insulation slabs:
  // - A 2.4m × 2.5m × 0.1m floor insulation has ~13m² mesh surface (all 6 faces)
  // - But only 6m² is the actual thermal barrier (the XY face)
  const double scaleSquared = displayScale * displayScale;
  std::unordered_map<std::string, double> surfaceAreaByMaterial;
  for (const auto& obj : result.sceneData.objects) {
    if (obj.geometry && !obj.materialId.empty()) {
      // Look up material to check if it's a thermal envelope material
      const PBRMaterial* mat = g_materialLibrary.get(obj.materialId);
      bool isThermalEnvelope = mat && (mat->category == "insulation" || mat->category == "masonry");

      double scaledArea;
      if (isThermalEnvelope) {
        // Use thermal envelope area calculation (projected area perpendicular to heat flow)
        scaledArea = CalculateThermalEnvelopeArea(*obj.geometry);
        TraceLog(LOG_INFO, "THERMAL-AREA: Material '%s' category='%s' using thermal envelope area: %.2f mm²",
                 obj.materialId.c_str(), mat->category.c_str(), scaledArea);
      } else {
        // Use full 3D surface area for non-thermal materials
        scaledArea = obj.geometry->SurfaceArea();
      }

      // Undo display scaling (area scales with scale²), then convert mm² to m²
      double originalArea_m2 = scaledArea / scaleSquared / 1000000.0;
      TraceLog(LOG_INFO, "AREA-CALC: Material '%s' scaledArea=%.2f scaleSquared=%.9f originalArea=%.2f m²",
               obj.materialId.c_str(), scaledArea, scaleSquared, originalArea_m2);
      surfaceAreaByMaterial[obj.materialId] += originalArea_m2;
    }
  }

  // Update each material item with its total surface area
  for (auto& mat : result.materials) {
    auto it = surfaceAreaByMaterial.find(mat.materialId);
    if (it != surfaceAreaByMaterial.end()) {
      mat.surfaceArea = static_cast<float>(it->second);
    }
  }

  // Parse assembly instructions if exported from scene
  // Format: export const assembly = {
  //   projectName: "My Project",
  //   steps: [
  //     { title: "Lay Foundation", description: "...", objects: [0, 1, 2],
  //       parts: [{ name: "Concrete Paver", materialId: "concrete_paver", quantity: 8 }] },
  //     ...
  //   ]
  // };
  if (!JS_IsUndefined(assemblyVal) && !JS_IsException(assemblyVal) && JS_IsObject(assemblyVal)) {
    TraceLog(LOG_INFO, "ASSEMBLY: Parsing scene-defined assembly instructions");

    // Get project name
    JSValue projNameVal = JS_GetPropertyStr(ctx, assemblyVal, "projectName");
    if (!JS_IsUndefined(projNameVal)) {
      const char* str = JS_ToCString(ctx, projNameVal);
      if (str) {
        result.assembly.projectName = str;
        JS_FreeCString(ctx, str);
      }
    }
    JS_FreeValue(ctx, projNameVal);

    // Parse steps array
    JSValue stepsVal = JS_GetPropertyStr(ctx, assemblyVal, "steps");
    if (!JS_IsUndefined(stepsVal) && JS_IsArray(stepsVal)) {
      JSValue stepsLenVal = JS_GetPropertyStr(ctx, stepsVal, "length");
      uint32_t stepsLen = 0;
      if (JS_ToUint32(ctx, &stepsLen, stepsLenVal) >= 0) {
        for (uint32_t i = 0; i < stepsLen; ++i) {
          JSValue stepVal = JS_GetPropertyUint32(ctx, stepsVal, i);
          AssemblyStep step;
          step.stepNumber = static_cast<int>(i + 1);

          // Get title
          JSValue titleVal = JS_GetPropertyStr(ctx, stepVal, "title");
          if (!JS_IsUndefined(titleVal)) {
            const char* str = JS_ToCString(ctx, titleVal);
            if (str) { step.title = str; JS_FreeCString(ctx, str); }
          }
          JS_FreeValue(ctx, titleVal);

          // Get description
          JSValue descVal = JS_GetPropertyStr(ctx, stepVal, "description");
          if (!JS_IsUndefined(descVal)) {
            const char* str = JS_ToCString(ctx, descVal);
            if (str) { step.description = str; JS_FreeCString(ctx, str); }
          }
          JS_FreeValue(ctx, descVal);

          // Get showMaterials array (which materials are visible at this step)
          JSValue matsVal = JS_GetPropertyStr(ctx, stepVal, "showMaterials");
          if (!JS_IsUndefined(matsVal) && JS_IsArray(matsVal)) {
            JSValue matsLenVal = JS_GetPropertyStr(ctx, matsVal, "length");
            uint32_t matsLen = 0;
            if (JS_ToUint32(ctx, &matsLen, matsLenVal) >= 0) {
              for (uint32_t j = 0; j < matsLen; ++j) {
                JSValue matVal = JS_GetPropertyUint32(ctx, matsVal, j);
                const char* str = JS_ToCString(ctx, matVal);
                if (str) {
                  step.showMaterials.push_back(str);
                  JS_FreeCString(ctx, str);
                }
                JS_FreeValue(ctx, matVal);
              }
            }
            JS_FreeValue(ctx, matsLenVal);
          }
          JS_FreeValue(ctx, matsVal);

          // Get showObjects array (specific objects to show - more fine-grained than materials)
          JSValue objsVal = JS_GetPropertyStr(ctx, stepVal, "showObjects");
          if (!JS_IsUndefined(objsVal) && JS_IsArray(objsVal)) {
            JSValue objsLenVal = JS_GetPropertyStr(ctx, objsVal, "length");
            uint32_t objsLen = 0;
            if (JS_ToUint32(ctx, &objsLen, objsLenVal) >= 0) {
              for (uint32_t j = 0; j < objsLen; ++j) {
                JSValue objVal = JS_GetPropertyUint32(ctx, objsVal, j);
                const char* str = JS_ToCString(ctx, objVal);
                if (str) {
                  step.showObjects.push_back(str);
                  JS_FreeCString(ctx, str);
                }
                JS_FreeValue(ctx, objVal);
              }
            }
            JS_FreeValue(ctx, objsLenVal);
          }
          JS_FreeValue(ctx, objsVal);

          // Get parts array
          JSValue partsVal = JS_GetPropertyStr(ctx, stepVal, "parts");
          if (!JS_IsUndefined(partsVal) && JS_IsArray(partsVal)) {
            JSValue partsLenVal = JS_GetPropertyStr(ctx, partsVal, "length");
            uint32_t partsLen = 0;
            if (JS_ToUint32(ctx, &partsLen, partsLenVal) >= 0) {
              for (uint32_t j = 0; j < partsLen; ++j) {
                JSValue partVal = JS_GetPropertyUint32(ctx, partsVal, j);
                AssemblyPart part;

                JSValue partNameVal = JS_GetPropertyStr(ctx, partVal, "name");
                if (!JS_IsUndefined(partNameVal)) {
                  const char* str = JS_ToCString(ctx, partNameVal);
                  if (str) { part.name = str; JS_FreeCString(ctx, str); }
                }
                JS_FreeValue(ctx, partNameVal);

                JSValue partMatVal = JS_GetPropertyStr(ctx, partVal, "materialId");
                if (!JS_IsUndefined(partMatVal)) {
                  const char* str = JS_ToCString(ctx, partMatVal);
                  if (str) { part.materialId = str; JS_FreeCString(ctx, str); }
                }
                JS_FreeValue(ctx, partMatVal);

                JSValue partQtyVal = JS_GetPropertyStr(ctx, partVal, "quantity");
                if (!JS_IsUndefined(partQtyVal)) {
                  // Quantity can be a number or string
                  if (JS_IsNumber(partQtyVal)) {
                    int32_t q = 1;
                    if (JS_ToInt32(ctx, &q, partQtyVal) >= 0) {
                      part.quantity = std::to_string(q);
                    }
                  } else {
                    const char* str = JS_ToCString(ctx, partQtyVal);
                    if (str) { part.quantity = str; JS_FreeCString(ctx, str); }
                  }
                }
                JS_FreeValue(ctx, partQtyVal);

                JSValue partNoteVal = JS_GetPropertyStr(ctx, partVal, "note");
                if (!JS_IsUndefined(partNoteVal)) {
                  const char* str = JS_ToCString(ctx, partNoteVal);
                  if (str) { part.note = str; JS_FreeCString(ctx, str); }
                }
                JS_FreeValue(ctx, partNoteVal);

                step.parts.push_back(part);
                JS_FreeValue(ctx, partVal);
              }
            }
            JS_FreeValue(ctx, partsLenVal);
          }
          JS_FreeValue(ctx, partsVal);

          // Get subSteps array (detailed instructions)
          JSValue subStepsVal = JS_GetPropertyStr(ctx, stepVal, "subSteps");
          if (!JS_IsUndefined(subStepsVal) && JS_IsArray(subStepsVal)) {
            JSValue subStepsLenVal = JS_GetPropertyStr(ctx, subStepsVal, "length");
            uint32_t subStepsLen = 0;
            if (JS_ToUint32(ctx, &subStepsLen, subStepsLenVal) >= 0) {
              for (uint32_t j = 0; j < subStepsLen; ++j) {
                JSValue subStepVal = JS_GetPropertyUint32(ctx, subStepsVal, j);
                SubStep subStep;

                JSValue instrVal = JS_GetPropertyStr(ctx, subStepVal, "instruction");
                if (!JS_IsUndefined(instrVal)) {
                  const char* str = JS_ToCString(ctx, instrVal);
                  if (str) { subStep.instruction = str; JS_FreeCString(ctx, str); }
                }
                JS_FreeValue(ctx, instrVal);

                JSValue tipVal = JS_GetPropertyStr(ctx, subStepVal, "tip");
                if (!JS_IsUndefined(tipVal)) {
                  const char* str = JS_ToCString(ctx, tipVal);
                  if (str) { subStep.tip = str; JS_FreeCString(ctx, str); }
                }
                JS_FreeValue(ctx, tipVal);

                JSValue timeVal = JS_GetPropertyStr(ctx, subStepVal, "timeMinutes");
                if (!JS_IsUndefined(timeVal)) {
                  int32_t t = 0;
                  if (JS_ToInt32(ctx, &t, timeVal) >= 0) {
                    subStep.timeMinutes = t;
                  }
                }
                JS_FreeValue(ctx, timeVal);

                step.subSteps.push_back(subStep);
                JS_FreeValue(ctx, subStepVal);
              }
            }
            JS_FreeValue(ctx, subStepsLenVal);
          }
          JS_FreeValue(ctx, subStepsVal);

          // Get total time for step
          JSValue totalTimeVal = JS_GetPropertyStr(ctx, stepVal, "timeMinutes");
          if (!JS_IsUndefined(totalTimeVal)) {
            int32_t t = 0;
            if (JS_ToInt32(ctx, &t, totalTimeVal) >= 0) {
              step.totalTimeMinutes = t;
            }
          }
          JS_FreeValue(ctx, totalTimeVal);

          result.assembly.steps.push_back(step);
          JS_FreeValue(ctx, stepVal);
        }
      }
      JS_FreeValue(ctx, stepsLenVal);
    }
    JS_FreeValue(ctx, stepsVal);

    TraceLog(LOG_INFO, "ASSEMBLY: Parsed %zu scene-defined steps", result.assembly.steps.size());
  }
  JS_FreeValue(ctx, assemblyVal);

  result.success = true;
  result.message = "Loaded " + shortenHomePath(absolutePath.string()) + " (" +
                   std::to_string(result.sceneData.objects.size()) + " object(s))";
  assignDependencies();
  JS_FreeValue(ctx, sceneVal);
  JS_FreeValue(ctx, materialsVal);
  JS_FreeContext(ctx);

  auto loadEnd = std::chrono::high_resolution_clock::now();
  auto readMs = std::chrono::duration_cast<std::chrono::milliseconds>(afterRead - loadStart).count();
  auto bindingsMs = std::chrono::duration_cast<std::chrono::milliseconds>(afterBindings - afterRead).count();
  auto compileMs = std::chrono::duration_cast<std::chrono::milliseconds>(afterCompile - afterBindings).count();
  auto resolveMs = std::chrono::duration_cast<std::chrono::milliseconds>(afterResolve - afterCompile).count();
  auto evalMs = std::chrono::duration_cast<std::chrono::milliseconds>(afterEval - afterResolve).count();
  auto parseMs = std::chrono::duration_cast<std::chrono::milliseconds>(loadEnd - afterEval).count();
  auto totalMs = std::chrono::duration_cast<std::chrono::milliseconds>(loadEnd - loadStart).count();

  TraceLog(LOG_INFO, "PROFILE: LoadSceneFromFile: read=%lld ms, bindings=%lld ms, compile=%lld ms, "
           "resolve=%lld ms, eval/CSG=%lld ms, parse=%lld ms, TOTAL=%lld ms",
           readMs, bindingsMs, compileMs, resolveMs, evalMs, parseMs, totalMs);

  return result;
}

BackgroundLoadResult LoadAndTessellate(const std::filesystem::path& path) {
  auto start = std::chrono::high_resolution_clock::now();
  BackgroundLoadResult result;

  JSRuntime* runtime = JS_NewRuntime();
  if (!runtime) {
    result.message = "Failed to create JS runtime for background load";
    return result;
  }

  EnsureManifoldClass(runtime);

  ModuleLoaderData localLoaderData;
  JS_SetModuleLoaderFunc(runtime, nullptr, FilesystemModuleLoader, &localLoaderData);

  LoadResult loadResult = LoadSceneFromFile(runtime, path, &localLoaderData);
  result.success = loadResult.success;
  result.message = loadResult.message;
  result.sceneData = std::move(loadResult.sceneData);
  result.dependencies = std::move(loadResult.dependencies);
  result.materials = std::move(loadResult.materials);
  result.assembly = std::move(loadResult.assembly);
  result.displayScale = loadResult.displayScale;

  if (!result.success) {
    JS_FreeRuntime(runtime);
    return result;
  }

  auto afterLoad = std::chrono::high_resolution_clock::now();

  struct TessTask {
    std::future<manifold::MeshGL> future;
    Color color;
    std::string materialId;
    std::string objectId;
    size_t sceneObjectIndex;
    float roughness;
    float metallic;
  };
  std::vector<TessTask> tasks;
  tasks.reserve(result.sceneData.objects.size());

  for (size_t i = 0; i < result.sceneData.objects.size(); ++i) {
    const auto& obj = result.sceneData.objects[i];
    if (obj.geometry) {
      tasks.push_back({
        std::async(std::launch::async, [geom = obj.geometry]() {
          return geom->GetMeshGL();
        }),
        obj.color,
        obj.materialId,
        obj.objectId,
        i,
        obj.roughness,
        obj.metallic
      });
    }
  }

  result.meshes.reserve(tasks.size());
  for (auto& task : tasks) {
    result.meshes.push_back({task.future.get(), task.color, task.materialId, task.objectId, task.sceneObjectIndex, task.roughness, task.metallic});
  }

  auto end = std::chrono::high_resolution_clock::now();
  auto loadMs = std::chrono::duration_cast<std::chrono::milliseconds>(afterLoad - start).count();
  auto tessMs = std::chrono::duration_cast<std::chrono::milliseconds>(end - afterLoad).count();
  auto totalMs = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

  TraceLog(LOG_INFO, "PROFILE: LoadAndTessellate (background): load=%lld ms, tess=%lld ms, total=%lld ms",
           loadMs, tessMs, totalMs);

  JS_FreeRuntime(runtime);
  return result;
}

}  // namespace helscoop

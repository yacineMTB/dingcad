#include "material_loader.h"
#include "file_utils.h"

#include "quickjs.h"

#include <iostream>
#include <set>

namespace helscoop {

// Global material library instance
MaterialLibrary g_materialLibrary;

namespace {

// Helper to get string property from JS object
std::string GetStringProp(JSContext* ctx, JSValue obj, const char* name) {
  JSValue val = JS_GetPropertyStr(ctx, obj, name);
  std::string result;
  if (!JS_IsUndefined(val) && !JS_IsException(val)) {
    const char* str = JS_ToCString(ctx, val);
    if (str) {
      result = str;
      JS_FreeCString(ctx, str);
    }
  }
  JS_FreeValue(ctx, val);
  return result;
}

// Helper to get float property from JS object
float GetFloatProp(JSContext* ctx, JSValue obj, const char* name, float defaultVal = 0.0f) {
  JSValue val = JS_GetPropertyStr(ctx, obj, name);
  double result = defaultVal;
  if (!JS_IsUndefined(val) && !JS_IsException(val)) {
    JS_ToFloat64(ctx, &result, val);
  }
  JS_FreeValue(ctx, val);
  return static_cast<float>(result);
}

// Helper to get RGB array from JS
std::array<float, 3> GetRGBProp(JSContext* ctx, JSValue obj, const char* name) {
  std::array<float, 3> result = {0.8f, 0.8f, 0.8f};
  JSValue val = JS_GetPropertyStr(ctx, obj, name);

  if (!JS_IsUndefined(val) && JS_IsArray(val)) {
    for (uint32_t i = 0; i < 3; ++i) {
      JSValue elem = JS_GetPropertyUint32(ctx, val, i);
      double v = 0.8;
      JS_ToFloat64(ctx, &v, elem);
      result[i] = static_cast<float>(v);
      JS_FreeValue(ctx, elem);
    }
  }

  JS_FreeValue(ctx, val);
  return result;
}

// Helper to get string array from JS
std::vector<std::string> GetStringArrayProp(JSContext* ctx, JSValue obj, const char* name) {
  std::vector<std::string> result;
  JSValue val = JS_GetPropertyStr(ctx, obj, name);

  if (!JS_IsUndefined(val) && JS_IsArray(val)) {
    JSValue lengthVal = JS_GetPropertyStr(ctx, val, "length");
    uint32_t length = 0;
    JS_ToUint32(ctx, &length, lengthVal);
    JS_FreeValue(ctx, lengthVal);

    for (uint32_t i = 0; i < length; ++i) {
      JSValue elem = JS_GetPropertyUint32(ctx, val, i);
      const char* str = JS_ToCString(ctx, elem);
      if (str) {
        result.emplace_back(str);
        JS_FreeCString(ctx, str);
      }
      JS_FreeValue(ctx, elem);
    }
  }

  JS_FreeValue(ctx, val);
  return result;
}

// Parse single material from JS object
PBRMaterial ParseMaterial(JSContext* ctx, const std::string& id, JSValue matObj) {
  PBRMaterial mat;
  mat.id = id;
  mat.name = GetStringProp(ctx, matObj, "name");
  mat.category = GetStringProp(ctx, matObj, "category");
  mat.tags = GetStringArrayProp(ctx, matObj, "tags");

  // Parse visual properties
  JSValue visualVal = JS_GetPropertyStr(ctx, matObj, "visual");
  if (!JS_IsUndefined(visualVal)) {
    mat.visual.albedo = GetRGBProp(ctx, visualVal, "albedo");
    mat.visual.roughness = GetFloatProp(ctx, visualVal, "roughness", 0.5f);
    mat.visual.metallic = GetFloatProp(ctx, visualVal, "metallic", 0.0f);
    mat.visual.albedoTexture = GetStringProp(ctx, visualVal, "albedoTexture");
    mat.visual.normalTexture = GetStringProp(ctx, visualVal, "normalTexture");
  }
  JS_FreeValue(ctx, visualVal);

  // Parse thermal properties
  JSValue thermalVal = JS_GetPropertyStr(ctx, matObj, "thermal");
  if (!JS_IsUndefined(thermalVal)) {
    mat.thermal.conductivity = GetFloatProp(ctx, thermalVal, "conductivity", 0.0f);
    mat.thermal.thickness = GetFloatProp(ctx, thermalVal, "thickness", 0.0f);
  }
  JS_FreeValue(ctx, thermalVal);

  // Parse pricing properties
  JSValue pricingVal = JS_GetPropertyStr(ctx, matObj, "pricing");
  if (!JS_IsUndefined(pricingVal)) {
    mat.pricing.unit = GetStringProp(ctx, pricingVal, "unit");
    mat.pricing.unitPrice = GetFloatProp(ctx, pricingVal, "unitPrice", 0.0f);
    mat.pricing.supplier = GetStringProp(ctx, pricingVal, "supplier");
    mat.pricing.link = GetStringProp(ctx, pricingVal, "link");
    mat.pricing.sku = GetStringProp(ctx, pricingVal, "sku");
    mat.pricing.ean = GetStringProp(ctx, pricingVal, "ean");
    mat.pricing.lastPriceCheck = GetStringProp(ctx, pricingVal, "lastPriceCheck");
    std::string cur = GetStringProp(ctx, pricingVal, "currency");
    if (!cur.empty()) mat.pricing.currency = cur;

    JSValue altArr = JS_GetPropertyStr(ctx, pricingVal, "alternativeSuppliers");
    if (!JS_IsUndefined(altArr) && JS_IsArray(altArr)) {
      JSValue lenVal = JS_GetPropertyStr(ctx, altArr, "length");
      uint32_t len = 0;
      JS_ToUint32(ctx, &len, lenVal);
      JS_FreeValue(ctx, lenVal);
      for (uint32_t i = 0; i < len; ++i) {
        JSValue altObj = JS_GetPropertyUint32(ctx, altArr, i);
        if (!JS_IsUndefined(altObj) && JS_IsObject(altObj)) {
          PBRPricing::AltSupplier alt;
          alt.supplier = GetStringProp(ctx, altObj, "supplier");
          alt.unitPrice = GetFloatProp(ctx, altObj, "unitPrice", 0.0f);
          alt.link = GetStringProp(ctx, altObj, "link");
          alt.sku = GetStringProp(ctx, altObj, "sku");
          mat.pricing.alternativeSuppliers.push_back(std::move(alt));
        }
        JS_FreeValue(ctx, altObj);
      }
    }
    JS_FreeValue(ctx, altArr);
  }
  JS_FreeValue(ctx, pricingVal);

  // Parse structural properties
  JSValue structVal = JS_GetPropertyStr(ctx, matObj, "structural");
  if (!JS_IsUndefined(structVal)) {
    mat.structural.gradeClass = GetStringProp(ctx, structVal, "gradeClass");
    mat.structural.maxSpan_floor_mm = GetFloatProp(ctx, structVal, "maxSpan_floor_mm", 0.0f);
    mat.structural.maxSpan_wall_mm = GetFloatProp(ctx, structVal, "maxSpan_wall_mm", 0.0f);
    mat.structural.maxSpan_rafter_mm = GetFloatProp(ctx, structVal, "maxSpan_rafter_mm", 0.0f);
    mat.structural.bendingStrength_MPa = GetFloatProp(ctx, structVal, "bendingStrength_MPa", 0.0f);
    mat.structural.modulus_GPa = GetFloatProp(ctx, structVal, "modulus_GPa", 0.0f);
  }
  JS_FreeValue(ctx, structVal);

  return mat;
}

}  // namespace

std::optional<MaterialLibrary> LoadMaterialLibrary(const std::filesystem::path& jsonPath) {
  auto source = ReadTextFile(jsonPath);
  if (!source) {
    std::cerr << "Failed to read material library: " << jsonPath << std::endl;
    return std::nullopt;
  }

  // Create temporary JS runtime for JSON parsing
  JSRuntime* rt = JS_NewRuntime();
  if (!rt) {
    std::cerr << "Failed to create JS runtime for material loading" << std::endl;
    return std::nullopt;
  }

  JSContext* ctx = JS_NewContext(rt);
  if (!ctx) {
    JS_FreeRuntime(rt);
    return std::nullopt;
  }

  // Parse JSON
  JSValue jsonVal = JS_ParseJSON(ctx, source->c_str(), source->size(), jsonPath.string().c_str());
  if (JS_IsException(jsonVal)) {
    JSValue exc = JS_GetException(ctx);
    const char* errStr = JS_ToCString(ctx, exc);
    std::cerr << "JSON parse error: " << (errStr ? errStr : "unknown") << std::endl;
    if (errStr) JS_FreeCString(ctx, errStr);
    JS_FreeValue(ctx, exc);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return std::nullopt;
  }

  MaterialLibrary library;
  library.basePath = jsonPath.parent_path();

  // Get materials object
  JSValue materialsObj = JS_GetPropertyStr(ctx, jsonVal, "materials");
  if (!JS_IsUndefined(materialsObj) && JS_IsObject(materialsObj)) {
    // Enumerate all properties (material IDs)
    JSPropertyEnum* props = nullptr;
    uint32_t propsLen = 0;

    if (JS_GetOwnPropertyNames(ctx, &props, &propsLen, materialsObj, JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY) == 0) {
      for (uint32_t i = 0; i < propsLen; ++i) {
        const char* idStr = JS_AtomToCString(ctx, props[i].atom);
        if (idStr) {
          JSValue matObj = JS_GetProperty(ctx, materialsObj, props[i].atom);
          if (!JS_IsUndefined(matObj) && JS_IsObject(matObj)) {
            std::string id = idStr;
            library.materials[id] = ParseMaterial(ctx, id, matObj);
          }
          JS_FreeValue(ctx, matObj);
          JS_FreeCString(ctx, idStr);
        }
        JS_FreeAtom(ctx, props[i].atom);
      }
      js_free(ctx, props);
    }
  }
  JS_FreeValue(ctx, materialsObj);

  JS_FreeValue(ctx, jsonVal);
  JS_FreeContext(ctx);
  JS_FreeRuntime(rt);

  std::cout << "Loaded " << library.materials.size() << " materials from " << jsonPath << std::endl;
  return library;
}

std::filesystem::path GetDefaultMaterialLibraryPath() {
  // Look relative to current working directory
  return std::filesystem::current_path() / "materials" / "materials.json";
}

bool InitMaterialLibrary(const std::filesystem::path& basePath) {
  auto libPath = basePath / "materials" / "materials.json";
  if (!std::filesystem::exists(libPath)) {
    std::cerr << "Material library not found: " << libPath << std::endl;
    return false;
  }

  auto lib = LoadMaterialLibrary(libPath);
  if (!lib) {
    return false;
  }

  g_materialLibrary = std::move(*lib);
  return true;
}

void LoadMaterialTextures() {
  int materialsWithTex = 0;
  TraceLog(LOG_INFO, "LoadMaterialTextures: checking %zu materials in library", g_materialLibrary.materials.size());
  for (auto& [id, mat] : g_materialLibrary.materials) {
    if (!mat.visual.albedoTexture.empty()) {
      materialsWithTex++;
      TraceLog(LOG_INFO, "Material '%s' has albedoTexture: '%s'", id.c_str(), mat.visual.albedoTexture.c_str());
    }
  }
  TraceLog(LOG_INFO, "Found %d materials with texture paths", materialsWithTex);

  // Deduplicate: load each unique texture file once, share across materials
  std::unordered_map<std::string, Texture2D> textureCache;
  int filesLoaded = 0;

  for (auto& [id, mat] : g_materialLibrary.materials) {
    if (!mat.visual.albedoTexture.empty()) {
      std::filesystem::path texPath = mat.visual.albedoTexture;
      if (texPath.is_relative()) {
        texPath = g_materialLibrary.basePath / texPath;
      }

      std::string canonical = std::filesystem::weakly_canonical(texPath).string();
      auto cached = textureCache.find(canonical);
      if (cached != textureCache.end()) {
        g_materialLibrary.loadedTextures[id] = cached->second;
        continue;
      }

      if (std::filesystem::exists(texPath)) {
        Texture2D tex = LoadTexture(texPath.string().c_str());
        if (tex.id != 0) {
          SetTextureWrap(tex, TEXTURE_WRAP_REPEAT);
          textureCache[canonical] = tex;
          g_materialLibrary.loadedTextures[id] = tex;
          filesLoaded++;
          TraceLog(LOG_INFO, "Loaded texture for material '%s': %s", id.c_str(), texPath.string().c_str());
        } else {
          TraceLog(LOG_WARNING, "Failed to load texture for material '%s': %s", id.c_str(), texPath.string().c_str());
        }
      } else {
        TraceLog(LOG_WARNING, "Texture file not found for material '%s': %s", id.c_str(), texPath.string().c_str());
      }
    }
  }

  if (filesLoaded > 0) {
    TraceLog(LOG_INFO, "Loaded %d unique texture files for %zu materials",
             filesLoaded, g_materialLibrary.loadedTextures.size());
  }
}

void UnloadMaterialTextures() {
  std::set<unsigned int> freed;
  for (auto& [id, tex] : g_materialLibrary.loadedTextures) {
    if (freed.insert(tex.id).second) {
      UnloadTexture(tex);
    }
  }
  g_materialLibrary.loadedTextures.clear();
}

}  // namespace helscoop

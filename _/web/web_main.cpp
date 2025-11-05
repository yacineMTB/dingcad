// Web-specific entry point for DingCAD
// This file provides web-compatible implementations for filesystem operations
// and main loop management

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/fetch.h>
#include <string>
#include <vector>
#include <memory>
#include <cstring>
#include <fstream>
#include <sstream>

// Forward declarations from main.cpp
extern "C" {
#include "quickjs.h"
}
#include "manifold/manifold.h"
#include "js_bindings.h"

// Web-specific state
struct WebState {
  JSRuntime* runtime = nullptr;
  std::shared_ptr<manifold::Manifold> scene = nullptr;
  std::string sceneCode;
  std::string statusMessage;
  bool needsReload = false;
};

static WebState g_webState;

// Web-compatible file reading using Emscripten FS
std::string ReadFileFromVirtualFS(const std::string& path) {
  // Try to read from Emscripten's virtual filesystem
  FILE* file = fopen(path.c_str(), "r");
  if (!file) {
    return "";
  }
  
  std::string content;
  char buffer[4096];
  while (fgets(buffer, sizeof(buffer), file)) {
    content += buffer;
  }
  fclose(file);
  return content;
}

// Load scene from JavaScript code string
extern "C" {
EMSCRIPTEN_KEEPALIVE
void loadSceneFromCode(const char* code) {
  if (!code) return;
  
  g_webState.sceneCode = code;
  g_webState.needsReload = true;
}

EMSCRIPTEN_KEEPALIVE
const char* getStatusMessage() {
  static std::string msg;
  msg = g_webState.statusMessage.empty() ? "Ready" : g_webState.statusMessage;
  return msg.c_str();
}
}

// Web-compatible module loader
JSModuleDef* WebModuleLoader(JSContext* ctx, const char* module_name, void* opaque) {
  // For web, we'll load from the virtual filesystem or from provided code
  std::string content;
  
  // First try virtual filesystem
  content = ReadFileFromVirtualFS(module_name);
  
  // If not found and it's the main scene, use the provided code
  if (content.empty() && strcmp(module_name, "scene.js") == 0 && !g_webState.sceneCode.empty()) {
    content = g_webState.sceneCode;
  }
  
  if (content.empty()) {
    JS_ThrowReferenceError(ctx, "Unable to load module '%s'", module_name);
    return nullptr;
  }
  
  JSValue funcVal = JS_Eval(ctx, content.c_str(), content.size(), module_name,
                            JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(funcVal)) {
    return nullptr;
  }
  
  auto* module = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(funcVal));
  JS_FreeValue(ctx, funcVal);
  return module;
}

// Scene loading function (adapted from main.cpp)
struct LoadResult {
  bool success = false;
  std::shared_ptr<manifold::Manifold> manifold;
  std::string message;
};

LoadResult LoadSceneFromCode(JSRuntime* runtime, const std::string& code) {
  LoadResult result;
  
  if (code.empty()) {
    result.message = "No scene code provided";
    return result;
  }
  
  JSContext* ctx = JS_NewContext(runtime);
  RegisterBindings(ctx);
  
  auto captureException = [&]() {
    JSValue exc = JS_GetException(ctx);
    JSValue stack = JS_GetPropertyStr(ctx, exc, "stack");
    const char* stackStr = JS_ToCString(ctx, JS_IsUndefined(stack) ? exc : stack);
    result.message = stackStr ? stackStr : "JavaScript error";
    JS_FreeCString(ctx, stackStr);
    JS_FreeValue(ctx, stack);
    JS_FreeValue(ctx, exc);
  };
  
  JSValue moduleFunc = JS_Eval(ctx, code.c_str(), code.size(), "scene.js",
                               JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(moduleFunc)) {
    captureException();
    JS_FreeContext(ctx);
    return result;
  }
  
  if (JS_ResolveModule(ctx, moduleFunc) < 0) {
    captureException();
    JS_FreeValue(ctx, moduleFunc);
    JS_FreeContext(ctx);
    return result;
  }
  
  auto* module = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(moduleFunc));
  JSValue evalResult = JS_EvalFunction(ctx, moduleFunc);
  if (JS_IsException(evalResult)) {
    captureException();
    JS_FreeContext(ctx);
    return result;
  }
  JS_FreeValue(ctx, evalResult);
  
  JSValue moduleNamespace = JS_GetModuleNamespace(ctx, module);
  if (JS_IsException(moduleNamespace)) {
    captureException();
    JS_FreeContext(ctx);
    return result;
  }
  
  JSValue sceneVal = JS_GetPropertyStr(ctx, moduleNamespace, "scene");
  if (JS_IsException(sceneVal)) {
    JS_FreeValue(ctx, moduleNamespace);
    captureException();
    JS_FreeContext(ctx);
    return result;
  }
  JS_FreeValue(ctx, moduleNamespace);
  
  if (JS_IsUndefined(sceneVal)) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeContext(ctx);
    result.message = "Scene module must export 'scene'";
    return result;
  }
  
  auto sceneHandle = GetManifoldHandle(ctx, sceneVal);
  if (!sceneHandle) {
    JS_FreeValue(ctx, sceneVal);
    JS_FreeContext(ctx);
    result.message = "Exported 'scene' is not a manifold";
    return result;
  }
  
  result.manifold = sceneHandle;
  result.success = true;
  result.message = "Scene loaded successfully";
  JS_FreeValue(ctx, sceneVal);
  JS_FreeContext(ctx);
  return result;
}

#endif // __EMSCRIPTEN__

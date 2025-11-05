#include "js_bindings.h"

#include <cstdlib>
#include <cstring>
#include <iostream>
#include <memory>
#include <string>

extern "C" {
#include "quickjs.h"
}

#include "manifold/manifold.h"

namespace {

void LogException(JSContext *ctx) {
  JSValue exception = JS_GetException(ctx);
  if (JS_IsError(ctx, exception)) {
    JSValue message = JS_GetPropertyStr(ctx, exception, "message");
    if (!JS_IsUndefined(message)) {
      size_t len = 0;
      const char *str = JS_ToCStringLen(ctx, &len, message);
      if (str) {
        std::cerr << "QuickJS error: " << std::string(str, len) << std::endl;
        JS_FreeCString(ctx, str);
      }
    }
    JS_FreeValue(ctx, message);
  }
  JS_FreeValue(ctx, exception);
}

}  // namespace

int main() {
  JSRuntime *runtime = JS_NewRuntime();
  if (!runtime) {
    std::cerr << "Failed to create QuickJS runtime." << std::endl;
    return EXIT_FAILURE;
  }

  EnsureManifoldClass(runtime);
  JSContext *ctx = JS_NewContext(runtime);
  if (!ctx) {
    std::cerr << "Failed to create QuickJS context." << std::endl;
    JS_FreeRuntime(runtime);
    return EXIT_FAILURE;
  }

  RegisterBindings(ctx);

  const char *script =
      "const shape = cube({ size: [20, 10, 5], center: true });\n"
      "surfaceArea(shape) > 0 ? shape : undefined;";

  JSValue result = JS_Eval(ctx, script, std::strlen(script), "smoke.js", JS_EVAL_TYPE_GLOBAL);
  if (JS_IsException(result)) {
    LogException(ctx);
    JS_FreeContext(ctx);
    JS_FreeRuntime(runtime);
    return EXIT_FAILURE;
  }

  std::shared_ptr<manifold::Manifold> handle = GetManifoldHandle(ctx, result);
  JS_FreeValue(ctx, result);
  if (!handle) {
    std::cerr << "Result did not resolve to a manifold." << std::endl;
    JS_FreeContext(ctx);
    JS_FreeRuntime(runtime);
    return EXIT_FAILURE;
  }

  const double volume = handle->Volume();
  const double area = handle->SurfaceArea();

  JS_FreeContext(ctx);
  JS_FreeRuntime(runtime);

  if (volume <= 0.0 || area <= 0.0) {
    std::cerr << "Unexpected geometry metrics. Volume: " << volume
              << ", Surface area: " << area << std::endl;
    return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}

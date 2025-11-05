#include "js_bindings.h"

#include <array>
#include <cmath>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

extern "C" {
#include "quickjs.h"
}

#include "manifold/manifold.h"

namespace {

std::string CaptureException(JSContext *ctx) {
  JSValue exception = JS_GetException(ctx);
  std::string message = "JavaScript exception";
  if (JS_IsError(ctx, exception)) {
    JSValue messageVal = JS_GetPropertyStr(ctx, exception, "message");
    if (!JS_IsUndefined(messageVal)) {
      size_t len = 0;
      const char *str = JS_ToCStringLen(ctx, &len, messageVal);
      if (str) {
        message.assign(str, len);
        JS_FreeCString(ctx, str);
      }
    }
    JS_FreeValue(ctx, messageVal);
  }
  JSValue stackVal = JS_GetPropertyStr(ctx, exception, "stack");
  if (!JS_IsUndefined(stackVal)) {
    size_t len = 0;
    const char *stack = JS_ToCStringLen(ctx, &len, stackVal);
    if (stack) {
      message.append("\n").append(stack, len);
      JS_FreeCString(ctx, stack);
    }
  }
  JS_FreeValue(ctx, stackVal);
  JS_FreeValue(ctx, exception);
  return message;
}

class JsEnv {
 public:
  JsEnv() {
    runtime_ = JS_NewRuntime();
    if (!runtime_) throw std::runtime_error("Failed to create QuickJS runtime");
    EnsureManifoldClass(runtime_);
    ctx_ = JS_NewContext(runtime_);
    if (!ctx_) {
      JS_FreeRuntime(runtime_);
      throw std::runtime_error("Failed to create QuickJS context");
    }
    RegisterBindings(ctx_);
  }

  ~JsEnv() {
    if (ctx_) JS_FreeContext(ctx_);
    if (runtime_) JS_FreeRuntime(runtime_);
  }

  using Validator = std::function<bool(JSContext *, JSValue, std::string &)>;

  bool Eval(const std::string &script, Validator validator, std::string &error) {
    JSValue result = JS_Eval(ctx_, script.c_str(), script.size(), "<test>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) {
      error = CaptureException(ctx_);
      return false;
    }
    bool ok = validator(ctx_, result, error);
    JS_FreeValue(ctx_, result);
    return ok;
  }

 private:
  JSRuntime *runtime_ = nullptr;
  JSContext *ctx_ = nullptr;
};

bool ReadDouble(JSContext *ctx, JSValue value, double &out, std::string &error) {
  if (JS_ToFloat64(ctx, &out, value) < 0) {
    error = "Expected number result";
    return false;
  }
  return true;
}

bool ReadInt(JSContext *ctx, JSValue value, int64_t &out, std::string &error) {
  if (JS_ToInt64(ctx, &out, value) < 0) {
    error = "Expected integer result";
    return false;
  }
  return true;
}

bool ReadBool(JSContext *ctx, JSValue value, bool &out, std::string &error) {
  int val = JS_ToBool(ctx, value);
  if (val < 0) {
    error = "Expected boolean result";
    return false;
  }
  out = val == 1;
  return true;
}

bool ReadString(JSContext *ctx, JSValue value, std::string &out, std::string &error) {
  const char *cstr = JS_ToCString(ctx, value);
  if (!cstr) {
    error = "Expected string result";
    return false;
  }
  out.assign(cstr);
  JS_FreeCString(ctx, cstr);
  return true;
}

bool ExtractPolygons(JSContext *ctx, JSValue value,
                     std::vector<std::vector<std::array<double, 2>>> &out,
                     std::string &error) {
  if (!JS_IsArray(value)) {
    error = "Result is not an array";
    return false;
  }
  JSValue lengthVal = JS_GetPropertyStr(ctx, value, "length");
  uint32_t loopCount = 0;
  if (JS_ToUint32(ctx, &loopCount, lengthVal) < 0) {
    error = "Unable to read polygon array length";
    JS_FreeValue(ctx, lengthVal);
    return false;
  }
  JS_FreeValue(ctx, lengthVal);
  out.clear();
  out.reserve(loopCount);
  for (uint32_t i = 0; i < loopCount; ++i) {
    JSValue loopVal = JS_GetPropertyUint32(ctx, value, i);
    if (JS_IsException(loopVal)) {
      error = "Failed to fetch polygon loop";
      return false;
    }
    if (!JS_IsArray(loopVal)) {
      error = "Loop is not an array";
      JS_FreeValue(ctx, loopVal);
      return false;
    }
    JSValue loopLenVal = JS_GetPropertyStr(ctx, loopVal, "length");
    uint32_t pointCount = 0;
    if (JS_ToUint32(ctx, &pointCount, loopLenVal) < 0) {
      error = "Unable to read loop length";
      JS_FreeValue(ctx, loopLenVal);
      JS_FreeValue(ctx, loopVal);
      return false;
    }
    JS_FreeValue(ctx, loopLenVal);
    std::vector<std::array<double, 2>> loop;
    loop.reserve(pointCount);
    for (uint32_t j = 0; j < pointCount; ++j) {
      JSValue pointVal = JS_GetPropertyUint32(ctx, loopVal, j);
      if (JS_IsException(pointVal)) {
        error = "Failed to fetch polygon point";
        JS_FreeValue(ctx, loopVal);
        return false;
      }
      if (!JS_IsArray(pointVal)) {
        error = "Point is not an array";
        JS_FreeValue(ctx, pointVal);
        JS_FreeValue(ctx, loopVal);
        return false;
      }
      JSValue xVal = JS_GetPropertyUint32(ctx, pointVal, 0);
      JSValue yVal = JS_GetPropertyUint32(ctx, pointVal, 1);
      double x = 0.0;
      double y = 0.0;
      bool okX = JS_ToFloat64(ctx, &x, xVal) >= 0;
      bool okY = JS_ToFloat64(ctx, &y, yVal) >= 0;
      JS_FreeValue(ctx, xVal);
      JS_FreeValue(ctx, yVal);
      JS_FreeValue(ctx, pointVal);
      if (!okX || !okY) {
        error = "Unable to read point coordinates";
        JS_FreeValue(ctx, loopVal);
        return false;
      }
      loop.push_back({x, y});
    }
    JS_FreeValue(ctx, loopVal);
    out.push_back(std::move(loop));
  }
  return true;
}

bool DoubleEquals(double actual, double expected, double tolerance) {
  return std::fabs(actual - expected) <= tolerance;
}

}  // namespace

int main() {
  JsEnv env;
  bool success = true;

  auto runTest = [&](const std::string &name, const std::string &script,
                     JsEnv::Validator validator) {
    std::string error;
    if (!env.Eval(script, validator, error)) {
      std::cerr << "[FAIL] " << name << ": " << error << std::endl;
      success = false;
    } else {
      std::cout << "[PASS] " << name << std::endl;
    }
  };

  runTest("surfaceArea cube",
          R"JS(
surfaceArea(cube({ size: [10, 10, 10], center: false }));
)JS",
          [](JSContext *ctx, JSValue result, std::string &error) {
            double value = 0.0;
            if (!ReadDouble(ctx, result, value, error)) return false;
            if (!DoubleEquals(value, 600.0, 1e-3)) {
              error = "Expected surface area 600";
              return false;
            }
            return true;
          });

  runTest("numVertices cube",
          R"JS(
numVertices(cube({ size: [10, 10, 10], center: false }));
)JS",
          [](JSContext *ctx, JSValue result, std::string &error) {
            int64_t count = 0;
            if (!ReadInt(ctx, result, count, error)) return false;
            if (count != 8) {
              error = "Cube should have 8 vertices";
              return false;
            }
            return true;
          });

  runTest("numTriangles cube",
          R"JS(
numTriangles(cube({ size: [10, 10, 10], center: true }));
)JS",
          [](JSContext *ctx, JSValue result, std::string &error) {
            int64_t count = 0;
            if (!ReadInt(ctx, result, count, error)) return false;
            if (count != 12) {
              error = "Cube should have 12 triangles";
              return false;
            }
            return true;
          });

  runTest("difference is empty",
          R"JS(
isEmpty(difference(cube({ size: [5, 5, 5], center: true }), cube({ size: [5, 5, 5], center: true })));
)JS",
          [](JSContext *ctx, JSValue result, std::string &error) {
            bool value = false;
            if (!ReadBool(ctx, result, value, error)) return false;
            if (!value) {
              error = "Difference should result in empty manifold";
              return false;
            }
            return true;
          });

  runTest("status is NoError",
          R"JS(
status(cube({ size: [5, 5, 5], center: true }));
)JS",
          [](JSContext *ctx, JSValue result, std::string &error) {
            std::string str;
            if (!ReadString(ctx, result, str, error)) return false;
            if (str != "NoError") {
              error = "Expected status NoError";
              return false;
            }
            return true;
          });

  runTest("slice produces square loop",
          R"JS(
slice(cube({ size: [10, 10, 10], center: true }), 0);
)JS",
          [](JSContext *ctx, JSValue result, std::string &error) {
            std::vector<std::vector<std::array<double, 2>>> loops;
            if (!ExtractPolygons(ctx, result, loops, error)) return false;
            if (loops.size() != 1) {
              error = "Expected one loop from slice";
              return false;
            }
            if (loops[0].size() != 4) {
              error = "Expected four vertices in slice loop";
              return false;
            }
            return true;
          });

  runTest("project produces square loop",
          R"JS(
project(cube({ size: [10, 10, 10], center: true }));
)JS",
          [](JSContext *ctx, JSValue result, std::string &error) {
            std::vector<std::vector<std::array<double, 2>>> loops;
            if (!ExtractPolygons(ctx, result, loops, error)) return false;
            if (loops.empty()) {
              error = "Expected loops from project";
              return false;
            }
            if (loops[0].size() != 4) {
              error = "Projected loop should have 4 vertices";
              return false;
            }
            return true;
          });

  return success ? EXIT_SUCCESS : EXIT_FAILURE;
}

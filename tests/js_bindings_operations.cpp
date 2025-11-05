#include "js_bindings.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <sstream>
#include <vector>

extern "C" {
#include "quickjs.h"
}

#include "manifold/manifold.h"

namespace {

constexpr double kPi = 3.14159265358979323846;

struct BoundingBox {
  std::array<double, 3> min{};
  std::array<double, 3> max{};
};

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

bool ReadDouble(JSContext *ctx, JSValue value, double &out, std::string &err) {
  if (JS_ToFloat64(ctx, &out, value) < 0) {
    err = "Expected number";
    return false;
  }
  return true;
}

bool ReadBool(JSContext *ctx, JSValue value, bool &out, std::string &err) {
  int v = JS_ToBool(ctx, value);
  if (v < 0) {
    err = "Expected boolean";
    return false;
  }
  out = v == 1;
  return true;
}

bool ReadInt(JSContext *ctx, JSValue value, int64_t &out, std::string &err) {
  if (JS_ToInt64(ctx, &out, value) < 0) {
    err = "Expected integer";
    return false;
  }
  return true;
}

bool ReadString(JSContext *ctx, JSValue value, std::string &out, std::string &err) {
  const char *str = JS_ToCString(ctx, value);
  if (!str) {
    err = "Expected string";
    return false;
  }
  out.assign(str);
  JS_FreeCString(ctx, str);
  return true;
}

bool ReadBoundingBox(JSContext *ctx, JSValue value, BoundingBox &out, std::string &err) {
  JSValue minVal = JS_GetPropertyStr(ctx, value, "min");
  JSValue maxVal = JS_GetPropertyStr(ctx, value, "max");
  if (JS_IsUndefined(minVal) || JS_IsUndefined(maxVal)) {
    err = "Bounding box missing min/max";
    JS_FreeValue(ctx, minVal);
    JS_FreeValue(ctx, maxVal);
    return false;
  }
  auto parseVec = [&](JSValue vecVal, std::array<double, 3> &target) -> bool {
    if (!JS_IsArray(vecVal)) {
      err = "Bounding box component is not array";
      return false;
    }
    for (uint32_t i = 0; i < 3; ++i) {
      JSValue component = JS_GetPropertyUint32(ctx, vecVal, i);
      if (JS_IsException(component)) {
        err = "Failed to read bounding box component";
        return false;
      }
      if (JS_ToFloat64(ctx, &target[i], component) < 0) {
        err = "Bounding box component not numeric";
        JS_FreeValue(ctx, component);
        return false;
      }
      JS_FreeValue(ctx, component);
    }
    return true;
  };
  bool okMin = parseVec(minVal, out.min);
  bool okMax = parseVec(maxVal, out.max);
  JS_FreeValue(ctx, minVal);
  JS_FreeValue(ctx, maxVal);
  if (!okMin || !okMax) return false;
  return true;
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

  bool Eval(const std::string &script,
            const std::function<bool(JSContext *, JSValue, std::string &)> &validator,
            std::string &error) {
    JSValue result =
        JS_Eval(ctx_, script.c_str(), script.size(), "<test>", JS_EVAL_TYPE_GLOBAL);
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

bool AlmostEqual(double a, double b, double rel = 1e-6, double abs = 1e-9) {
  double diff = std::fabs(a - b);
  if (diff <= abs) return true;
  return diff <= rel * std::max(std::fabs(a), std::fabs(b));
}

}  // namespace

int main() {
  JsEnv env;
  bool success = true;

  auto run = [&](const std::string &name, const std::string &script,
                 std::function<bool(JSContext *, JSValue, std::string &)> validator) {
    std::string error;
    if (!env.Eval(script, validator, error)) {
      std::cerr << "[FAIL] " << name << ": " << error << std::endl;
      success = false;
    } else {
      std::cout << "[PASS] " << name << std::endl;
    }
  };

  run("rotate swaps extents",
      R"JS(
(() => {
  const base = cube({ size: [10, 20, 5], center: true });
  const rotated = rotate(base, [0, 0, 90]);
  return boundingBox(rotated);
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        BoundingBox box{};
        if (!ReadBoundingBox(ctx, result, box, error)) return false;
        const double sizeX = box.max[0] - box.min[0];
        const double sizeY = box.max[1] - box.min[1];
        if (!AlmostEqual(sizeX, 20.0, 1e-6, 1e-3)) {
          error = "Expected sizeX near 20 after rotation";
          return false;
        }
        if (!AlmostEqual(sizeY, 10.0, 1e-6, 1e-3)) {
          error = "Expected sizeY near 10 after rotation";
          return false;
        }
        return true;
      });

  run("mirror flips across YZ plane",
      R"JS(
(() => {
  const base = translate(cube({ size: [2, 2, 2], center: false }), [4, 0, 0]);
  const mirrored = mirror(base, [1, 0, 0]);
  return boundingBox(mirrored);
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        BoundingBox box{};
        if (!ReadBoundingBox(ctx, result, box, error)) return false;
        if (!AlmostEqual(box.min[0], -6.0, 1e-6, 1e-6)) {
          error = "Expected mirrored min.x near -6";
          return false;
        }
        if (!AlmostEqual(box.max[0], -4.0, 1e-6, 1e-6)) {
          error = "Expected mirrored max.x near -4";
          return false;
        }
        return true;
      });

  run("transform applies translation",
      R"JS(
(() => {
  const base = cube({ size: [1, 1, 1], center: false });
  const matrix = [
    1, 0, 0, 3,
    0, 1, 0, -2,
    0, 0, 1, 5
  ];
  const transformed = transform(base, matrix);
  return boundingBox(transformed);
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        BoundingBox box{};
        if (!ReadBoundingBox(ctx, result, box, error)) return false;
        if (!AlmostEqual(box.min[0], 3.0, 1e-3, 1e-1) ||
            !AlmostEqual(box.max[0], 4.0, 1e-3, 1e-1)) {
          std::ostringstream oss;
          oss << "Transform X bounds incorrect: min=" << box.min[0]
              << " max=" << box.max[0];
          error = oss.str();
          return false;
        }
        if (!AlmostEqual(box.min[1], -2.0, 1e-3, 1e-1) ||
            !AlmostEqual(box.max[1], -1.0, 1e-3, 1e-1)) {
          std::ostringstream oss;
          oss << "Transform Y bounds incorrect: min=" << box.min[1]
              << " max=" << box.max[1];
          error = oss.str();
          return false;
        }
        if (!AlmostEqual(box.min[2], 5.0, 1e-3, 1e-1) ||
            !AlmostEqual(box.max[2], 6.0, 1e-3, 1e-1)) {
          std::ostringstream oss;
          oss << "Transform Z bounds incorrect: min=" << box.min[2]
              << " max=" << box.max[2];
          error = oss.str();
          return false;
        }
        return true;
      });

  run("boolean subtract matches expected volume",
      R"JS(
(() => {
  const block = cube({ size: [20, 20, 20], center: true });
  const hole = sphere({ radius: 8 });
  return {
    volume: volume(boolean(block, hole, "subtract"))
  };
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        JSValue volumeVal = JS_GetPropertyStr(ctx, result, "volume");
        if (JS_IsUndefined(volumeVal)) {
          error = "Result missing volume";
          return false;
        }
        double actual = 0.0;
        bool ok = ReadDouble(ctx, volumeVal, actual, error);
        JS_FreeValue(ctx, volumeVal);
        if (!ok) return false;
        const double cubeVol = 8000.0;
        const double sphereVol = 4.0 / 3.0 * kPi * std::pow(8.0, 3.0);
        const double expected = cubeVol - sphereVol;
        if (!AlmostEqual(actual, expected, 5e-2, 2.5)) {
          error = "Boolean subtract volume mismatch";
          return false;
        }
        return true;
      });

  run("batchBoolean union merges volume",
      R"JS(
(() => {
  const a = translate(cube({ size: [10, 10, 10], center: true }), [-8, 0, 0]);
  const b = translate(cube({ size: [10, 10, 10], center: true }), [8, 0, 0]);
  const merged = batchBoolean("add", [a, b]);
  return volume(merged);
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        double vol = 0.0;
        if (!ReadDouble(ctx, result, vol, error)) return false;
        if (!AlmostEqual(vol, 2000.0, 1e-6, 1e-3)) {
          error = "Batch union volume mismatch";
          return false;
        }
        return true;
      });

  run("hull spans inputs",
      R"JS(
(() => {
  const left = translate(cube({ size: [2, 2, 2], center: true }), [-3, 0, 0]);
  const right = translate(cube({ size: [2, 2, 2], center: true }), [3, 0, 0]);
  return boundingBox(hull(left, right));
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        BoundingBox box{};
        if (!ReadBoundingBox(ctx, result, box, error)) return false;
        if (box.min[0] > -3.6 || box.max[0] < 3.6) {
          error = "Hull did not span expected X range";
          return false;
        }
        return true;
      });

  run("hullPoints forms tetrahedron",
      R"JS(
(() => {
  const points = [
    [0, 0, 0],
    [2, 0, 0],
    [0, 2, 0],
    [0, 0, 2]
  ];
  const solid = hullPoints(points);
  return {
    volume: volume(solid),
    vertices: numVertices(solid)
  };
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        JSValue volVal = JS_GetPropertyStr(ctx, result, "volume");
        JSValue vertVal = JS_GetPropertyStr(ctx, result, "vertices");
        if (JS_IsUndefined(volVal) || JS_IsUndefined(vertVal)) {
          error = "Missing hullPoints fields";
          JS_FreeValue(ctx, volVal);
          JS_FreeValue(ctx, vertVal);
          return false;
        }
        double vol = 0.0;
        int64_t verts = 0;
        bool okVol = ReadDouble(ctx, volVal, vol, error);
        bool okVerts = ReadInt(ctx, vertVal, verts, error);
        JS_FreeValue(ctx, volVal);
        JS_FreeValue(ctx, vertVal);
        if (!okVol || !okVerts) return false;
        if (!AlmostEqual(vol, 4.0 / 3.0, 1e-6, 1e-3)) {
          error = "HullPoints volume mismatch";
          return false;
        }
        if (verts != 4) {
          error = "HullPoints expected 4 vertices";
          return false;
        }
        return true;
      });

  run("trimByPlane halves cube",
      R"JS(
(() => {
  const base = cube({ size: [10, 10, 10], center: true });
  const trimmed = trimByPlane(base, [1, 0, 0], -0.1);
  return {
    volume: volume(trimmed),
    empty: isEmpty(trimmed),
    maxX: boundingBox(trimmed).max[0]
  };
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        JSValue volVal = JS_GetPropertyStr(ctx, result, "volume");
        JSValue emptyVal = JS_GetPropertyStr(ctx, result, "empty");
        JSValue maxVal = JS_GetPropertyStr(ctx, result, "maxX");
        if (JS_IsUndefined(volVal) || JS_IsUndefined(emptyVal) || JS_IsUndefined(maxVal)) {
          error = "Trim result missing fields";
          JS_FreeValue(ctx, volVal);
          JS_FreeValue(ctx, emptyVal);
          JS_FreeValue(ctx, maxVal);
          return false;
        }
        double vol = 0.0;
        bool okVol = ReadDouble(ctx, volVal, vol, error);
        JS_FreeValue(ctx, volVal);
        if (!okVol) {
          JS_FreeValue(ctx, emptyVal);
          JS_FreeValue(ctx, maxVal);
          return false;
        }
        bool isEmptyResult = false;
        bool okEmpty = ReadBool(ctx, emptyVal, isEmptyResult, error);
        JS_FreeValue(ctx, emptyVal);
        if (!okEmpty) {
          JS_FreeValue(ctx, maxVal);
          return false;
        }
        double maxX = 0.0;
        bool okMax = ReadDouble(ctx, maxVal, maxX, error);
        JS_FreeValue(ctx, maxVal);
        if (!okMax) return false;
        if (isEmptyResult) {
          error = "Trim produced empty manifold unexpectedly";
          return false;
        }
        if (!AlmostEqual(vol, 500.0, 1e-2, 2.0)) {
          std::ostringstream oss;
          oss << "Trimmed volume mismatch: actual=" << vol;
          error = oss.str();
          return false;
        }
        if (maxX > 1.5) {
          std::ostringstream oss;
          oss << "Trimmed maxX should be near zero: maxX=" << maxX;
          error = oss.str();
          return false;
        }
        return true;
      });

  run("revolve makes cylinder volume",
      R"JS(
(() => {
  const profile = [
    [
      [5, 0],
      [5, 10]
    ]
  ];
  const solid = revolve(profile, { segments: 32, degrees: 360 });
  return volume(solid);
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        double volume = 0.0;
        if (!ReadDouble(ctx, result, volume, error)) return false;
        const double expected = kPi * 5.0 * 5.0 * 10.0;
        if (!AlmostEqual(volume, expected, 3e-1, 7.5)) {
          std::ostringstream oss;
          oss << "Revolve cylinder volume mismatch: actual=" << volume
              << " expected=" << expected;
          error = oss.str();
          return false;
        }
        return true;
      });

  run("setTolerance updates tolerance",
      R"JS(
(() => {
  const base = sphere({ radius: 5 });
  const updated = setTolerance(base, 0.25);
  return getTolerance(updated);
})()
)JS",
      [](JSContext *ctx, JSValue result, std::string &error) {
        double tol = 0.0;
        if (!ReadDouble(ctx, result, tol, error)) return false;
        if (!AlmostEqual(tol, 0.25, 1e-6, 1e-6)) {
          error = "Tolerance was not updated";
          return false;
        }
        return true;
      });

  return success ? EXIT_SUCCESS : EXIT_FAILURE;
}

#include "js_bindings.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

extern "C" {
#include "quickjs.h"
}

#include "manifold/common.h"
#include "manifold/manifold.h"

namespace {

constexpr double kPi = 3.14159265358979323846;

bool AlmostEqual(double a, double b, double relTol = 1e-6, double absTol = 1e-9) {
  const double diff = std::fabs(a - b);
  if (diff <= absTol) return true;
  return diff <= relTol * std::max(std::fabs(a), std::fabs(b));
}

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
    if (!runtime_) {
      throw std::runtime_error("Failed to create QuickJS runtime");
    }
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

  bool EvalShape(const std::string &script, std::shared_ptr<manifold::Manifold> &out,
                 std::string &error) {
    JSValue result =
        JS_Eval(ctx_, script.c_str(), script.size(), "<test>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) {
      error = CaptureException(ctx_);
      return false;
    }
    auto handle = GetManifoldHandle(ctx_, result);
    JS_FreeValue(ctx_, result);
    if (!handle) {
      error = "Result was not a manifold";
      return false;
    }
    out = std::move(handle);
    return true;
  }

  bool EvalExpectFailure(const std::string &script, std::string &error) {
    std::shared_ptr<manifold::Manifold> dummy;
    if (EvalShape(script, dummy, error)) {
      error = "Evaluation unexpectedly succeeded";
      return false;
    }
    return true;
  }

 private:
  JSRuntime *runtime_ = nullptr;
  JSContext *ctx_ = nullptr;
};

struct GeometryTestCase {
  std::string name;
  std::string script;
  std::function<bool(const manifold::Manifold &, std::string &)> validator;
};

}  // namespace

int main() {
  JsEnv env;
  bool ok = true;

  std::vector<GeometryTestCase> cases = {
      {
          "Cube volume and area",
          R"JS(
(() => {
  const shape = cube({ size: [10, 10, 10], center: false });
  return shape;
})()
)JS",
          [](const manifold::Manifold &shape, std::string &msg) {
            if (shape.IsEmpty()) {
              msg = "Cube is unexpectedly empty";
              return false;
            }
            const double volume = shape.Volume();
            const double surface = shape.SurfaceArea();
            const auto box = shape.BoundingBox();
            const auto size = box.Size();
            if (!AlmostEqual(volume, 1000.0, 1e-6, 1e-3)) {
              msg = "Volume mismatch for cube";
              return false;
            }
            if (!AlmostEqual(surface, 600.0, 1e-6, 1e-3)) {
              msg = "Surface area mismatch for cube";
              return false;
            }
            if (!AlmostEqual(size.x, 10.0) || !AlmostEqual(size.y, 10.0) ||
                !AlmostEqual(size.z, 10.0)) {
              msg = "Bounding box size mismatch for cube";
              return false;
            }
            return true;
          },
      },
      {
          "Union disjoint cubes",
          R"JS(
(() => {
  const base = cube({ size: [10, 10, 10], center: true });
  const shifted = translate(base, [15, 0, 0]);
  return union(base, shifted);
})()
)JS",
          [](const manifold::Manifold &shape, std::string &msg) {
            const double expected = 2000.0;
            if (!AlmostEqual(shape.Volume(), expected, 1e-6, 1e-3)) {
              msg = "Unexpected volume for union";
              return false;
            }
            const auto size = shape.BoundingBox().Size();
            if (size.x < 24.9 || size.x > 25.1) {
              msg = "Union bounding box width incorrect";
              return false;
            }
            return true;
          },
      },
      {
          "Difference subtract sphere",
          R"JS(
(() => {
  const block = cube({ size: [20, 20, 20], center: true });
  const hole = sphere({ radius: 8 });
  const smoothHole = refineToTolerance(hole, 0.2);
  return difference(block, smoothHole);
})()
)JS",
          [](const manifold::Manifold &shape, std::string &msg) {
            const double cubeVol = 8000.0;
            const double sphereVol = 4.0 / 3.0 * kPi * std::pow(8.0, 3.0);
            const double expected = cubeVol - sphereVol;
            if (!AlmostEqual(shape.Volume(), expected, 5e-3, 5e-1)) {
              msg = "Unexpected volume after difference operation";
              return false;
            }
            if (shape.IsEmpty()) {
              msg = "Difference produced empty manifold";
              return false;
            }
            return true;
          },
      },
      {
          "Scaling adjusts volume",
          R"JS(
(() => {
  const base = cube({ size: [10, 10, 10], center: true });
  return scale(base, [1.5, 2.0, 0.5]);
})()
)JS",
          [](const manifold::Manifold &shape, std::string &msg) {
            const double expected = 1500.0;  // 1000 * (1.5 * 2.0 * 0.5)
            if (!AlmostEqual(shape.Volume(), expected, 1e-6, 1e-3)) {
              msg = "Scaled cube volume mismatch";
              return false;
            }
            const auto size = shape.BoundingBox().Size();
            if (!AlmostEqual(size.x, 15.0) || !AlmostEqual(size.y, 20.0) ||
                !AlmostEqual(size.z, 5.0)) {
              msg = "Scaled cube bounding box mismatch";
              return false;
            }
            return true;
          },
      },
      {
          "Translation shifts bounding box",
          R"JS(
(() => {
  const base = cube({ size: [10, 10, 10], center: true });
  return translate(base, [5, 0, 0]);
})()
)JS",
          [](const manifold::Manifold &shape, std::string &msg) {
            const auto box = shape.BoundingBox();
            if (box.min.x < -1e-6 || !AlmostEqual(box.min.x, 0.0, 1e-6, 1e-6)) {
              msg = "Translated cube min bound incorrect";
              return false;
            }
            if (!AlmostEqual(box.max.x, 10.0, 1e-6, 1e-6)) {
              msg = "Translated cube max bound incorrect";
              return false;
            }
            return true;
          },
      },
      {
          "Extrude triangles",
          R"JS(
(() => {
  const polys = [
    [
      [0, 0],
      [20, 0],
      [0, 20]
    ]
  ];
  return extrude(polys, { height: 5 });
})()
)JS",
          [](const manifold::Manifold &shape, std::string &msg) {
            const double baseArea = 0.5 * 20.0 * 20.0;
            const double expected = baseArea * 5.0;
            if (!AlmostEqual(shape.Volume(), expected, 1e-6, 1e-3)) {
              msg = "Extruded prism volume mismatch";
              return false;
            }
            const auto box = shape.BoundingBox();
            if (!AlmostEqual(box.min.z, 0.0) || !AlmostEqual(box.max.z, 5.0)) {
              msg = "Extruded prism height incorrect";
              return false;
            }
            return true;
          },
      },
  };

  for (const auto &test : cases) {
    std::shared_ptr<manifold::Manifold> shape;
    std::string evalError;
    if (!env.EvalShape(test.script, shape, evalError)) {
      std::cerr << "[FAIL] " << test.name << ": " << evalError << std::endl;
      ok = false;
      continue;
    }
    std::string validationError;
    if (!test.validator(*shape, validationError)) {
      std::cerr << "[FAIL] " << test.name << ": " << validationError << std::endl;
      ok = false;
    } else {
      std::cout << "[PASS] " << test.name << std::endl;
    }
  }

  std::string failureMsg;
  if (!env.EvalExpectFailure(
          R"JS(
(() => {
  const value = 42;
  return value;
})()
)JS",
          failureMsg)) {
    std::cerr << "[FAIL] Non-manifold result did not fail: " << failureMsg << std::endl;
    ok = false;
  } else {
    std::cout << "[PASS] Non-manifold result rejected" << std::endl;
  }

  return ok ? EXIT_SUCCESS : EXIT_FAILURE;
}

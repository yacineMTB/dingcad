#include "js_bindings.h"

#include <array>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "manifold/manifold.h"
#include "manifold/polygon.h"
#include "manifold/meshIO.h"
namespace {

void PrintLoadMeshError(const std::string &message) {
  const char esc = 0x1B;
  std::fprintf(stderr, "%c[31m%s%c[0m\n", esc, message.c_str(), esc);
  std::fflush(stderr);
}


struct JsManifold {
  std::shared_ptr<manifold::Manifold> handle;
};

JSClassID g_manifoldClassId;

void JsManifoldFinalizer(JSRuntime *rt, JSValue val) {
  (void)rt;
  auto *wrapper = static_cast<JsManifold *>(JS_GetOpaque(val, g_manifoldClassId));
  delete wrapper;
}

void EnsureManifoldClassInternal(JSRuntime *runtime) {
  static bool idInitialised = false;
  static bool classRegistered = false;
  if (!idInitialised) {
    JS_NewClassID(runtime, &g_manifoldClassId);
    idInitialised = true;
  }
  if (!classRegistered) {
    JSClassDef def{};
    def.class_name = "Manifold";
    def.finalizer = JsManifoldFinalizer;
    JS_NewClass(runtime, g_manifoldClassId, &def);
    classRegistered = true;
  }
}

JSValue WrapManifold(JSContext *ctx, std::shared_ptr<manifold::Manifold> manifold) {
  JSValue obj = JS_NewObjectClass(ctx, g_manifoldClassId);
  if (JS_IsException(obj)) return obj;
  auto *wrapper = new JsManifold{std::move(manifold)};
  JS_SetOpaque(obj, wrapper);
  return obj;
}

JsManifold *GetJsManifold(JSContext *ctx, JSValueConst value) {
  return static_cast<JsManifold *>(JS_GetOpaque2(ctx, value, g_manifoldClassId));
}

std::shared_ptr<manifold::Manifold> GetManifoldHandleInternal(JSContext *ctx,
                                                              JSValueConst value) {
  JsManifold *jsManifold = GetJsManifold(ctx, value);
  if (!jsManifold) return nullptr;
  return jsManifold->handle;
}

bool GetVec3(JSContext *ctx, JSValueConst value, std::array<double, 3> &out) {
  if (!JS_IsArray(value)) {
    JS_ThrowTypeError(ctx, "expected array of three numbers");
    return false;
  }
  for (uint32_t i = 0; i < 3; ++i) {
    JSValue element = JS_GetPropertyUint32(ctx, value, i);
    if (JS_IsUndefined(element)) {
      JS_FreeValue(ctx, element);
      JS_ThrowTypeError(ctx, "vector requires three entries");
      return false;
    }
    if (JS_ToFloat64(ctx, &out[i], element) < 0) {
      JS_FreeValue(ctx, element);
      return false;
    }
    JS_FreeValue(ctx, element);
  }
  return true;
}

bool GetVec2(JSContext *ctx, JSValueConst value, std::array<double, 2> &out) {
  if (!JS_IsArray(value)) {
    JS_ThrowTypeError(ctx, "expected array of two numbers");
    return false;
  }
  for (uint32_t i = 0; i < 2; ++i) {
    JSValue element = JS_GetPropertyUint32(ctx, value, i);
    if (JS_IsUndefined(element)) {
      JS_FreeValue(ctx, element);
      JS_ThrowTypeError(ctx, "vector requires two entries");
      return false;
    }
    if (JS_ToFloat64(ctx, &out[i], element) < 0) {
      JS_FreeValue(ctx, element);
      return false;
    }
    JS_FreeValue(ctx, element);
  }
  return true;
}

bool GetMat3x4(JSContext *ctx, JSValueConst value, manifold::mat3x4 &out) {
  if (!JS_IsArray(value)) {
    JS_ThrowTypeError(ctx, "transform expects array of 12 numbers");
    return false;
  }
  std::array<double, 12> entries{};
  for (uint32_t i = 0; i < 12; ++i) {
    JSValue element = JS_GetPropertyUint32(ctx, value, i);
    if (JS_IsUndefined(element)) {
      JS_FreeValue(ctx, element);
      JS_ThrowTypeError(ctx, "transform array requires 12 entries");
      return false;
    }
    if (JS_ToFloat64(ctx, &entries[i], element) < 0) {
      JS_FreeValue(ctx, element);
      return false;
    }
    JS_FreeValue(ctx, element);
  }
  for (int row = 0; row < 3; ++row) {
    for (int col = 0; col < 4; ++col) {
      out[row][col] = entries[row * 4 + col];
    }
  }
  return true;
}

JSValue Vec3ToJs(JSContext *ctx, const manifold::vec3 &v) {
  JSValue arr = JS_NewArray(ctx);
  JS_SetPropertyUint32(ctx, arr, 0, JS_NewFloat64(ctx, v.x));
  JS_SetPropertyUint32(ctx, arr, 1, JS_NewFloat64(ctx, v.y));
  JS_SetPropertyUint32(ctx, arr, 2, JS_NewFloat64(ctx, v.z));
  return arr;
}

JSValue Vec2ToJs(JSContext *ctx, const manifold::vec2 &v) {
  JSValue arr = JS_NewArray(ctx);
  JS_SetPropertyUint32(ctx, arr, 0, JS_NewFloat64(ctx, v.x));
  JS_SetPropertyUint32(ctx, arr, 1, JS_NewFloat64(ctx, v.y));
  return arr;
}

bool JsValueToPolygons(JSContext *ctx, JSValueConst value,
                       manifold::Polygons &out) {
  if (!JS_IsArray(value)) {
    JS_ThrowTypeError(ctx, "polygons must be an array of loops");
    return false;
  }
  JSValue lengthVal = JS_GetPropertyStr(ctx, value, "length");
  uint32_t numLoops = 0;
  if (JS_ToUint32(ctx, &numLoops, lengthVal) < 0) {
    JS_FreeValue(ctx, lengthVal);
    return false;
  }
  JS_FreeValue(ctx, lengthVal);
  manifold::Polygons result;
  result.reserve(numLoops);
  for (uint32_t i = 0; i < numLoops; ++i) {
    JSValue loopVal = JS_GetPropertyUint32(ctx, value, i);
    if (JS_IsException(loopVal)) return false;
    if (!JS_IsArray(loopVal)) {
      JS_FreeValue(ctx, loopVal);
      JS_ThrowTypeError(ctx, "each loop must be an array of [x,y] points");
      return false;
    }
    JSValue loopLenVal = JS_GetPropertyStr(ctx, loopVal, "length");
    uint32_t loopLen = 0;
    if (JS_ToUint32(ctx, &loopLen, loopLenVal) < 0) {
      JS_FreeValue(ctx, loopLenVal);
      JS_FreeValue(ctx, loopVal);
      return false;
    }
    JS_FreeValue(ctx, loopLenVal);
    manifold::SimplePolygon loop;
    loop.reserve(loopLen);
    for (uint32_t j = 0; j < loopLen; ++j) {
      JSValue pointVal = JS_GetPropertyUint32(ctx, loopVal, j);
      if (JS_IsException(pointVal)) {
        JS_FreeValue(ctx, loopVal);
        return false;
      }
      std::array<double, 2> point{};
      bool ok = GetVec2(ctx, pointVal, point);
      JS_FreeValue(ctx, pointVal);
      if (!ok) {
        JS_FreeValue(ctx, loopVal);
        return false;
      }
      manifold::vec2 pt{point[0], point[1]};
      loop.push_back(pt);
    }
    JS_FreeValue(ctx, loopVal);
    result.push_back(loop);
  }
  out = std::move(result);
  return true;
}

JSValue PolygonsToJs(JSContext *ctx, const manifold::Polygons &polys) {
  JSValue arr = JS_NewArray(ctx);
  uint32_t loopIdx = 0;
  for (const auto &loop : polys) {
    JSValue loopArr = JS_NewArray(ctx);
    uint32_t pointIdx = 0;
    for (const auto &pt : loop) {
      JS_SetPropertyUint32(ctx, loopArr, pointIdx++, Vec2ToJs(ctx, pt));
    }
    JS_SetPropertyUint32(ctx, arr, loopIdx++, loopArr);
  }
  return arr;
}

bool CollectManifoldArgs(JSContext *ctx, int argc, JSValueConst *argv,
                         std::vector<manifold::Manifold> &out) {
  if (argc == 0) {
    JS_ThrowTypeError(ctx, "expected at least one manifold");
    return false;
  }
  if (argc == 1 && JS_IsArray(argv[0])) {
    JSValue arr = argv[0];
    JSValue lengthVal = JS_GetPropertyStr(ctx, arr, "length");
    uint32_t len = 0;
    if (JS_ToUint32(ctx, &len, lengthVal) < 0) {
      JS_FreeValue(ctx, lengthVal);
      return false;
    }
    JS_FreeValue(ctx, lengthVal);
    out.reserve(len);
    for (uint32_t i = 0; i < len; ++i) {
      JSValue itemVal = JS_GetPropertyUint32(ctx, arr, i);
      if (JS_IsException(itemVal)) return false;
      JsManifold *jsManifold = GetJsManifold(ctx, itemVal);
      JS_FreeValue(ctx, itemVal);
      if (!jsManifold) return false;
      out.push_back(*jsManifold->handle);
    }
    return true;
  }
  out.reserve(argc);
  for (int i = 0; i < argc; ++i) {
    JsManifold *jsManifold = GetJsManifold(ctx, argv[i]);
    if (!jsManifold) return false;
    out.push_back(*jsManifold->handle);
  }
  return true;
}

JSValue ManifoldVectorToJsArray(JSContext *ctx,
                                std::vector<manifold::Manifold> manifolds) {
  JSValue arr = JS_NewArray(ctx);
  uint32_t idx = 0;
  for (auto &mf : manifolds) {
    auto wrapped = std::make_shared<manifold::Manifold>(std::move(mf));
    JS_SetPropertyUint32(ctx, arr, idx++, WrapManifold(ctx, std::move(wrapped)));
  }
  return arr;
}

bool JsArrayToVec3List(JSContext *ctx, JSValueConst value,
                       std::vector<manifold::vec3> &out) {
  if (!JS_IsArray(value)) {
    JS_ThrowTypeError(ctx, "expected array of [x,y,z] points");
    return false;
  }
  JSValue lengthVal = JS_GetPropertyStr(ctx, value, "length");
  uint32_t length = 0;
  if (JS_ToUint32(ctx, &length, lengthVal) < 0) {
    JS_FreeValue(ctx, lengthVal);
    return false;
  }
  JS_FreeValue(ctx, lengthVal);
  std::vector<manifold::vec3> result;
  result.reserve(length);
  for (uint32_t i = 0; i < length; ++i) {
    JSValue pointVal = JS_GetPropertyUint32(ctx, value, i);
    if (JS_IsException(pointVal)) return false;
    std::array<double, 3> coords{};
    bool ok = GetVec3(ctx, pointVal, coords);
    JS_FreeValue(ctx, pointVal);
    if (!ok) return false;
    manifold::vec3 vec{coords[0], coords[1], coords[2]};
    result.push_back(vec);
  }
  out = std::move(result);
  return true;
}

bool GetOpType(JSContext *ctx, JSValueConst value, manifold::OpType &out) {
  if (JS_IsString(value)) {
    const char *opStr = JS_ToCString(ctx, value);
    if (!opStr) return false;
    std::string opLower(opStr);
    JS_FreeCString(ctx, opStr);
    for (auto &c : opLower) {
      c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    if (opLower == "add" || opLower == "union") {
      out = manifold::OpType::Add;
      return true;
    }
    if (opLower == "subtract" || opLower == "difference") {
      out = manifold::OpType::Subtract;
      return true;
    }
    if (opLower == "intersect" || opLower == "intersection") {
      out = manifold::OpType::Intersect;
      return true;
    }
    JS_ThrowTypeError(ctx, "unknown boolean op");
    return false;
  }
  if (JS_IsNumber(value)) {
    int32_t idx = 0;
    if (JS_ToInt32(ctx, &idx, value) < 0) return false;
    switch (idx) {
      case 0:
        out = manifold::OpType::Add;
        return true;
      case 1:
        out = manifold::OpType::Subtract;
        return true;
      case 2:
        out = manifold::OpType::Intersect;
        return true;
      default:
        JS_ThrowRangeError(ctx, "boolean op index must be 0,1,2");
        return false;
    }
  }
  JS_ThrowTypeError(ctx, "op must be string or number");
  return false;
}

const char *ErrorToString(manifold::Manifold::Error err) {
  switch (err) {
    case manifold::Manifold::Error::NoError:
      return "NoError";
    case manifold::Manifold::Error::NonFiniteVertex:
      return "NonFiniteVertex";
    case manifold::Manifold::Error::NotManifold:
      return "NotManifold";
    case manifold::Manifold::Error::VertexOutOfBounds:
      return "VertexOutOfBounds";
    case manifold::Manifold::Error::PropertiesWrongLength:
      return "PropertiesWrongLength";
    case manifold::Manifold::Error::MissingPositionProperties:
      return "MissingPositionProperties";
    case manifold::Manifold::Error::MergeVectorsDifferentLengths:
      return "MergeVectorsDifferentLengths";
    case manifold::Manifold::Error::MergeIndexOutOfBounds:
      return "MergeIndexOutOfBounds";
    case manifold::Manifold::Error::TransformWrongLength:
      return "TransformWrongLength";
    case manifold::Manifold::Error::RunIndexWrongLength:
      return "RunIndexWrongLength";
    case manifold::Manifold::Error::FaceIDWrongLength:
      return "FaceIDWrongLength";
    case manifold::Manifold::Error::InvalidConstruction:
      return "InvalidConstruction";
    case manifold::Manifold::Error::ResultTooLarge:
      return "ResultTooLarge";
  }
  return "Unknown";
}

bool GetBox(JSContext *ctx, JSValueConst value, manifold::Box &out) {
  if (!JS_IsObject(value)) {
    JS_ThrowTypeError(ctx, "bounds must be an object with min/max");
    return false;
  }
  JSValue minVal = JS_GetPropertyStr(ctx, value, "min");
  JSValue maxVal = JS_GetPropertyStr(ctx, value, "max");
  if (JS_IsUndefined(minVal) || JS_IsUndefined(maxVal)) {
    JS_FreeValue(ctx, minVal);
    JS_FreeValue(ctx, maxVal);
    JS_ThrowTypeError(ctx, "bounds requires min and max arrays");
    return false;
  }
  std::array<double, 3> minArr{};
  std::array<double, 3> maxArr{};
  bool okMin = GetVec3(ctx, minVal, minArr);
  bool okMax = okMin && GetVec3(ctx, maxVal, maxArr);
  JS_FreeValue(ctx, minVal);
  JS_FreeValue(ctx, maxVal);
  if (!okMax) return false;
  out.min = manifold::vec3{minArr[0], minArr[1], minArr[2]};
  out.max = manifold::vec3{maxArr[0], maxArr[1], maxArr[2]};
  return true;
}

JSValue JsCube(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  double sx = 1.0, sy = 1.0, sz = 1.0;
  bool center = false;
  if (argc >= 1 && JS_IsObject(argv[0])) {
    JSValue sizeVal = JS_GetPropertyStr(ctx, argv[0], "size");
    if (!JS_IsUndefined(sizeVal)) {
      std::array<double, 3> size{};
      if (!GetVec3(ctx, sizeVal, size)) {
        JS_FreeValue(ctx, sizeVal);
        return JS_EXCEPTION;
      }
      sx = size[0];
      sy = size[1];
      sz = size[2];
    }
    JS_FreeValue(ctx, sizeVal);
    JSValue centerVal = JS_GetPropertyStr(ctx, argv[0], "center");
    if (!JS_IsUndefined(centerVal)) {
      int c = JS_ToBool(ctx, centerVal);
      if (c < 0) {
        JS_FreeValue(ctx, centerVal);
        return JS_EXCEPTION;
      }
      center = c == 1;
    }
    JS_FreeValue(ctx, centerVal);
  }
  auto manifold = std::make_shared<manifold::Manifold>(manifold::Manifold::Cube({sx, sy, sz}, center));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsSphere(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  double radius = 1.0;
  if (argc >= 1 && JS_IsObject(argv[0])) {
    JSValue radiusVal = JS_GetPropertyStr(ctx, argv[0], "radius");
    if (!JS_IsUndefined(radiusVal)) {
      if (JS_ToFloat64(ctx, &radius, radiusVal) < 0) {
        JS_FreeValue(ctx, radiusVal);
        return JS_EXCEPTION;
      }
    }
    JS_FreeValue(ctx, radiusVal);
  }
  auto manifold = std::make_shared<manifold::Manifold>(manifold::Manifold::Sphere(radius, 0));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsCylinder(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  double height = 1.0;
  double radius = 0.5;
  double radiusTop = -1.0;
  bool center = false;
  if (argc >= 1 && JS_IsObject(argv[0])) {
    JSValue heightVal = JS_GetPropertyStr(ctx, argv[0], "height");
    if (!JS_IsUndefined(heightVal)) {
      if (JS_ToFloat64(ctx, &height, heightVal) < 0) {
        JS_FreeValue(ctx, heightVal);
        return JS_EXCEPTION;
      }
    }
    JS_FreeValue(ctx, heightVal);

    JSValue radiusVal = JS_GetPropertyStr(ctx, argv[0], "radius");
    if (!JS_IsUndefined(radiusVal)) {
      if (JS_ToFloat64(ctx, &radius, radiusVal) < 0) {
        JS_FreeValue(ctx, radiusVal);
        return JS_EXCEPTION;
      }
    }
    JS_FreeValue(ctx, radiusVal);

    JSValue radiusTopVal = JS_GetPropertyStr(ctx, argv[0], "radiusTop");
    if (!JS_IsUndefined(radiusTopVal)) {
      if (JS_ToFloat64(ctx, &radiusTop, radiusTopVal) < 0) {
        JS_FreeValue(ctx, radiusTopVal);
        return JS_EXCEPTION;
      }
    }
    JS_FreeValue(ctx, radiusTopVal);

    JSValue centerVal = JS_GetPropertyStr(ctx, argv[0], "center");
    if (!JS_IsUndefined(centerVal)) {
      int c = JS_ToBool(ctx, centerVal);
      if (c < 0) {
        JS_FreeValue(ctx, centerVal);
        return JS_EXCEPTION;
      }
      center = c == 1;
    }
    JS_FreeValue(ctx, centerVal);
  }
  double radiusHigh = (radiusTop < 0.0) ? radius : radiusTop;
  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::Cylinder(height, radius, radiusHigh, 0, center));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsBoolean(JSContext *ctx, int argc, JSValueConst *argv,
                  manifold::OpType op) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "boolean operation requires at least two manifolds");
  }
  JsManifold *base = GetJsManifold(ctx, argv[0]);
  if (!base) return JS_EXCEPTION;
  std::shared_ptr<manifold::Manifold> result =
      std::make_shared<manifold::Manifold>(*base->handle);
  for (int i = 1; i < argc; ++i) {
    JsManifold *next = GetJsManifold(ctx, argv[i]);
    if (!next) return JS_EXCEPTION;
    switch (op) {
      case manifold::OpType::Add:
        result = std::make_shared<manifold::Manifold>(*result + *next->handle);
        break;
      case manifold::OpType::Subtract:
        result = std::make_shared<manifold::Manifold>(*result - *next->handle);
        break;
      case manifold::OpType::Intersect:
        result = std::make_shared<manifold::Manifold>(*result ^ *next->handle);
        break;
    }
  }
  return WrapManifold(ctx, std::move(result));
}

JSValue JsUnion(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  return JsBoolean(ctx, argc, argv, manifold::OpType::Add);
}

JSValue JsDifference(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  return JsBoolean(ctx, argc, argv, manifold::OpType::Subtract);
}

JSValue JsIntersection(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  return JsBoolean(ctx, argc, argv, manifold::OpType::Intersect);
}

JSValue JsTranslate(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "translate expects (manifold, [x,y,z])");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  std::array<double, 3> offset{};
  if (!GetVec3(ctx, argv[1], offset)) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->Translate({offset[0], offset[1], offset[2]}));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsScale(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "scale expects (manifold, factor)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  manifold::vec3 scaleVec{1.0, 1.0, 1.0};
  if (JS_IsNumber(argv[1])) {
    double s = 1.0;
    if (JS_ToFloat64(ctx, &s, argv[1]) < 0) return JS_EXCEPTION;
    scaleVec = {s, s, s};
  } else {
    std::array<double, 3> factors{};
    if (!GetVec3(ctx, argv[1], factors)) return JS_EXCEPTION;
    scaleVec = {factors[0], factors[1], factors[2]};
  }
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->Scale(scaleVec));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsRotate(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "rotate expects (manifold, [x,y,z] degrees)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  std::array<double, 3> angles{};
  if (!GetVec3(ctx, argv[1], angles)) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->Rotate(angles[0], angles[1], angles[2]));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsTetrahedron(JSContext *ctx, JSValueConst, int, JSValueConst *) {
  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::Tetrahedron());
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsCompose(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  std::vector<manifold::Manifold> parts;
  if (!CollectManifoldArgs(ctx, argc, argv, parts)) return JS_EXCEPTION;
  if (parts.empty()) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::Compose(parts));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsDecompose(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "decompose expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  auto manifolds = target->handle->Decompose();
  return ManifoldVectorToJsArray(ctx, std::move(manifolds));
}

JSValue JsMirror(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "mirror expects (manifold, [x,y,z])");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  std::array<double, 3> normal{};
  if (!GetVec3(ctx, argv[1], normal)) return JS_EXCEPTION;
  manifold::vec3 plane{normal[0], normal[1], normal[2]};
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->Mirror(plane));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsTransform(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "transform expects (manifold, mat3x4)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  manifold::mat3x4 matrix{};
  if (!GetMat3x4(ctx, argv[1], matrix)) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->Transform(matrix));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsSetTolerance(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "setTolerance expects (manifold, tolerance)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  double tol = 0.0;
  if (JS_ToFloat64(ctx, &tol, argv[1]) < 0) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->SetTolerance(tol));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsSimplify(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "simplify expects (manifold, tolerance?)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  double tol = 0.0;
  if (argc >= 2 && !JS_IsUndefined(argv[1])) {
    if (JS_ToFloat64(ctx, &tol, argv[1]) < 0) return JS_EXCEPTION;
  }
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->Simplify(tol));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsRefine(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "refine expects (manifold, iterations)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  int32_t iterations = 0;
  if (JS_ToInt32(ctx, &iterations, argv[1]) < 0) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->Refine(iterations));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsRefineToLength(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "refineToLength expects (manifold, length)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  double length = 0.0;
  if (JS_ToFloat64(ctx, &length, argv[1]) < 0) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->RefineToLength(length));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsRefineToTolerance(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "refineToTolerance expects (manifold, tolerance)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  double tol = 0.0;
  if (JS_ToFloat64(ctx, &tol, argv[1]) < 0) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->RefineToTolerance(tol));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsHull(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  std::vector<manifold::Manifold> parts;
  if (!CollectManifoldArgs(ctx, argc, argv, parts)) return JS_EXCEPTION;
  if (parts.empty()) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::Hull(parts));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsHullPoints(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "hullPoints expects array of [x,y,z]");
  }
  std::vector<manifold::vec3> pts;
  if (!JsArrayToVec3List(ctx, argv[0], pts)) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::Hull(pts));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsTrimByPlane(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 3) {
    return JS_ThrowTypeError(ctx, "trimByPlane expects (manifold, [nx,ny,nz], offset)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  std::array<double, 3> normal{};
  if (!GetVec3(ctx, argv[1], normal)) return JS_EXCEPTION;
  double offset = 0.0;
  if (JS_ToFloat64(ctx, &offset, argv[2]) < 0) return JS_EXCEPTION;
  manifold::vec3 n{normal[0], normal[1], normal[2]};
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->TrimByPlane(n, offset));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsSurfaceArea(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "surfaceArea expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewFloat64(ctx, target->handle->SurfaceArea());
}

JSValue JsVolume(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "volume expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewFloat64(ctx, target->handle->Volume());
}

JSValue JsBoundingBox(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "boundingBox expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  manifold::Box box = target->handle->BoundingBox();
  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "min", Vec3ToJs(ctx, box.min));
  JS_SetPropertyStr(ctx, obj, "max", Vec3ToJs(ctx, box.max));
  return obj;
}

JSValue JsNumTriangles(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "numTriangles expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewInt64(ctx, static_cast<int64_t>(target->handle->NumTri()));
}

JSValue JsNumVertices(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "numVertices expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewInt64(ctx, static_cast<int64_t>(target->handle->NumVert()));
}

JSValue JsNumEdges(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "numEdges expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewInt64(ctx, static_cast<int64_t>(target->handle->NumEdge()));
}

JSValue JsGenus(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "genus expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewInt32(ctx, target->handle->Genus());
}

JSValue JsGetTolerance(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "getTolerance expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewFloat64(ctx, target->handle->GetTolerance());
}

JSValue JsIsEmpty(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "isEmpty expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewBool(ctx, target->handle->IsEmpty());
}

JSValue JsStatus(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "status expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  const char *err = ErrorToString(target->handle->Status());
  return JS_NewString(ctx, err);
}

JSValue JsSlice(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "slice expects (manifold, height?)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  double height = 0.0;
  if (argc >= 2 && !JS_IsUndefined(argv[1])) {
    if (JS_ToFloat64(ctx, &height, argv[1]) < 0) return JS_EXCEPTION;
  }
  manifold::Polygons polys = target->handle->Slice(height);
  return PolygonsToJs(ctx, polys);
}

JSValue JsProject(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "project expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  manifold::Polygons polys = target->handle->Project();
  return PolygonsToJs(ctx, polys);
}

JSValue JsExtrude(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "extrude expects (polygons, options)");
  }
  manifold::Polygons polys;
  if (!JsValueToPolygons(ctx, argv[0], polys)) return JS_EXCEPTION;
  if (!JS_IsObject(argv[1])) {
    return JS_ThrowTypeError(ctx, "extrude options must be an object");
  }
  JSValue opts = argv[1];
  double height = 1.0;
  int32_t divisions = 0;
  double twist = 0.0;
  manifold::vec2 scaleTop{1.0, 1.0};

  JSValue heightVal = JS_GetPropertyStr(ctx, opts, "height");
  if (!JS_IsUndefined(heightVal)) {
    if (JS_ToFloat64(ctx, &height, heightVal) < 0) {
      JS_FreeValue(ctx, heightVal);
      return JS_EXCEPTION;
    }
  }
  JS_FreeValue(ctx, heightVal);

  JSValue divVal = JS_GetPropertyStr(ctx, opts, "divisions");
  if (!JS_IsUndefined(divVal)) {
    if (JS_ToInt32(ctx, &divisions, divVal) < 0) {
      JS_FreeValue(ctx, divVal);
      return JS_EXCEPTION;
    }
  }
  JS_FreeValue(ctx, divVal);

  JSValue twistVal = JS_GetPropertyStr(ctx, opts, "twistDegrees");
  if (!JS_IsUndefined(twistVal)) {
    if (JS_ToFloat64(ctx, &twist, twistVal) < 0) {
      JS_FreeValue(ctx, twistVal);
      return JS_EXCEPTION;
    }
  }
  JS_FreeValue(ctx, twistVal);

  JSValue scaleVal = JS_GetPropertyStr(ctx, opts, "scaleTop");
  if (!JS_IsUndefined(scaleVal)) {
    if (JS_IsNumber(scaleVal)) {
      double s = 1.0;
      if (JS_ToFloat64(ctx, &s, scaleVal) < 0) {
        JS_FreeValue(ctx, scaleVal);
        return JS_EXCEPTION;
      }
      scaleTop = manifold::vec2{s, s};
    } else {
      std::array<double, 2> factors{};
      if (!GetVec2(ctx, scaleVal, factors)) {
        JS_FreeValue(ctx, scaleVal);
        return JS_EXCEPTION;
      }
      scaleTop = manifold::vec2{factors[0], factors[1]};
    }
  }
  JS_FreeValue(ctx, scaleVal);

  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::Extrude(polys, height, divisions, twist, scaleTop));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsRevolve(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "revolve expects (polygons, options?)");
  }
  manifold::Polygons polys;
  if (!JsValueToPolygons(ctx, argv[0], polys)) return JS_EXCEPTION;
  int32_t segments = 0;
  double degrees = 360.0;
  if (argc >= 2 && JS_IsObject(argv[1])) {
    JSValue opts = argv[1];
    JSValue segVal = JS_GetPropertyStr(ctx, opts, "segments");
    if (!JS_IsUndefined(segVal)) {
      if (JS_ToInt32(ctx, &segments, segVal) < 0) {
        JS_FreeValue(ctx, segVal);
        return JS_EXCEPTION;
      }
    }
    JS_FreeValue(ctx, segVal);
    JSValue degVal = JS_GetPropertyStr(ctx, opts, "degrees");
    if (!JS_IsUndefined(degVal)) {
      if (JS_ToFloat64(ctx, &degrees, degVal) < 0) {
        JS_FreeValue(ctx, degVal);
        return JS_EXCEPTION;
      }
    }
    JS_FreeValue(ctx, degVal);
  }
  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::Revolve(polys, segments, degrees));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsBatchBoolean(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "batchBoolean expects (op, manifolds)");
  }
  manifold::OpType op;
  if (!GetOpType(ctx, argv[0], op)) return JS_EXCEPTION;
  std::vector<manifold::Manifold> parts;
  if (JS_IsArray(argv[1])) {
    if (!CollectManifoldArgs(ctx, 1, &argv[1], parts)) return JS_EXCEPTION;
  } else {
    if (!CollectManifoldArgs(ctx, argc - 1, argv + 1, parts)) return JS_EXCEPTION;
  }
  if (parts.empty()) {
    JS_ThrowTypeError(ctx, "batchBoolean requires manifolds");
    return JS_EXCEPTION;
  }
  auto manifold = std::make_shared<manifold::Manifold>(
      manifold::Manifold::BatchBoolean(parts, op));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsBooleanOp(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 3) {
    return JS_ThrowTypeError(ctx, "boolean expects (manifoldA, manifoldB, op)");
  }
  JsManifold *base = GetJsManifold(ctx, argv[0]);
  if (!base) return JS_EXCEPTION;
  JsManifold *other = GetJsManifold(ctx, argv[1]);
  if (!other) return JS_EXCEPTION;
  manifold::OpType op;
  if (!GetOpType(ctx, argv[2], op)) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      base->handle->Boolean(*other->handle, op));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsLoadMesh(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "loadMesh expects (path[, forceCleanup])");
  }
  const char *pathStr = JS_ToCString(ctx, argv[0]);
  if (!pathStr) return JS_EXCEPTION;
  std::string path(pathStr);
  JS_FreeCString(ctx, pathStr);

  std::filesystem::path fsPath;
  if (!path.empty() && path[0] == '~') {
    const char *home = std::getenv("HOME");
    if (!home) {
      const std::string msg = "loadMesh: HOME is not set; cannot resolve '~'";
      PrintLoadMeshError(msg);
      return JS_ThrowInternalError(ctx, "%s", msg.c_str());
    }
    std::filesystem::path homePath(home);
    if (path.size() == 1) {
      fsPath = homePath;
    } else if (path[1] == '/') {
      fsPath = homePath / path.substr(2);
    } else {
      fsPath = homePath / path.substr(1);
    }
  } else {
    fsPath = std::filesystem::path(path);
  }

  std::error_code ec;
  if (!fsPath.is_absolute()) {
    auto absPath = std::filesystem::absolute(fsPath, ec);
    if (ec) {
      const std::string msg = "loadMesh: unable to resolve path '" + path + "'";
      PrintLoadMeshError(msg);
      return JS_ThrowInternalError(ctx, "loadMesh: unable to resolve path '%s'", path.c_str());
    }
    fsPath = absPath;
  }
  const std::string resolvedPath = fsPath.string();

  if (!std::filesystem::exists(fsPath, ec) || ec) {
    const std::string msg = "loadMesh: file not found '" + resolvedPath + "' (expected in ~/Downloads/models)";
    PrintLoadMeshError(msg);
    // Return an empty manifold so the scene can continue loading.
    auto handle = std::make_shared<manifold::Manifold>();
    return WrapManifold(ctx, std::move(handle));
  }
  if (!std::filesystem::is_regular_file(fsPath, ec) || ec) {
    const std::string msg = "loadMesh: not a regular file '" + resolvedPath + "'";
    PrintLoadMeshError(msg);
    // Return an empty manifold so the scene can continue loading.
    auto handle = std::make_shared<manifold::Manifold>();
    return WrapManifold(ctx, std::move(handle));
  }

  bool forceCleanup = false;
  if (argc >= 2 && !JS_IsUndefined(argv[1])) {
    int flag = JS_ToBool(ctx, argv[1]);
    if (flag < 0) return JS_EXCEPTION;
    forceCleanup = flag == 1;
  }

  try {
    manifold::MeshGL mesh = manifold::ImportMesh(fsPath.string(), forceCleanup);
    if (mesh.NumTri() == 0 || mesh.NumVert() == 0) {
      const std::string msg = "loadMesh: imported mesh is empty for '" + resolvedPath + "'";
      PrintLoadMeshError(msg);
      return JS_ThrowInternalError(ctx, "loadMesh: imported mesh is empty");
    }
    manifold::Manifold manifold(mesh);
    auto handle = std::make_shared<manifold::Manifold>(std::move(manifold));
    return WrapManifold(ctx, std::move(handle));
  } catch (const std::exception &e) {
    const std::string msg = std::string("loadMesh failed: ") + e.what();
    PrintLoadMeshError(msg);
    return JS_ThrowInternalError(ctx, "loadMesh failed: %s", e.what());
  }
}




JSValue JsLevelSet(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1 || !JS_IsObject(argv[0])) {
    return JS_ThrowTypeError(ctx, "levelSet expects options object");
  }
  JSValue opts = argv[0];
  JSValue sdfVal = JS_GetPropertyStr(ctx, opts, "sdf");
  if (!JS_IsFunction(ctx, sdfVal)) {
    JS_FreeValue(ctx, sdfVal);
    return JS_ThrowTypeError(ctx, "levelSet requires sdf function");
  }
  JSValue boundsVal = JS_GetPropertyStr(ctx, opts, "bounds");
  if (JS_IsUndefined(boundsVal)) {
    JS_FreeValue(ctx, sdfVal);
    return JS_ThrowTypeError(ctx, "levelSet requires bounds");
  }
  manifold::Box bounds;
  if (!GetBox(ctx, boundsVal, bounds)) {
    JS_FreeValue(ctx, sdfVal);
    JS_FreeValue(ctx, boundsVal);
    return JS_EXCEPTION;
  }
  JS_FreeValue(ctx, boundsVal);

  JSValue edgeVal = JS_GetPropertyStr(ctx, opts, "edgeLength");
  if (JS_IsUndefined(edgeVal)) {
    JS_FreeValue(ctx, sdfVal);
    return JS_ThrowTypeError(ctx, "levelSet requires edgeLength");
  }
  double edgeLength = 0.0;
  if (JS_ToFloat64(ctx, &edgeLength, edgeVal) < 0) {
    JS_FreeValue(ctx, sdfVal);
    JS_FreeValue(ctx, edgeVal);
    return JS_EXCEPTION;
  }
  JS_FreeValue(ctx, edgeVal);

  double level = 0.0;
  double tolerance = -1.0;
  bool canParallel = false;

  JSValue levelVal = JS_GetPropertyStr(ctx, opts, "level");
  if (!JS_IsUndefined(levelVal)) {
    if (JS_ToFloat64(ctx, &level, levelVal) < 0) {
      JS_FreeValue(ctx, sdfVal);
      JS_FreeValue(ctx, levelVal);
      return JS_EXCEPTION;
    }
  }
  JS_FreeValue(ctx, levelVal);

  JSValue tolVal = JS_GetPropertyStr(ctx, opts, "tolerance");
  if (!JS_IsUndefined(tolVal)) {
    if (JS_ToFloat64(ctx, &tolerance, tolVal) < 0) {
      JS_FreeValue(ctx, sdfVal);
      JS_FreeValue(ctx, tolVal);
      return JS_EXCEPTION;
    }
  }
  JS_FreeValue(ctx, tolVal);

  JSValue parallelVal = JS_GetPropertyStr(ctx, opts, "canParallel");
  if (!JS_IsUndefined(parallelVal)) {
    int p = JS_ToBool(ctx, parallelVal);
    if (p < 0) {
      JS_FreeValue(ctx, sdfVal);
      JS_FreeValue(ctx, parallelVal);
      return JS_EXCEPTION;
    }
    canParallel = p == 1;
  }
  JS_FreeValue(ctx, parallelVal);

  if (canParallel) {
    JS_FreeValue(ctx, sdfVal);
    return JS_ThrowTypeError(ctx,
                             "levelSet canParallel must be false when using JS SDF");
  }

  JSValue sdfFunc = JS_DupValue(ctx, sdfVal);
  JS_FreeValue(ctx, sdfVal);

  bool errorOccurred = false;
  std::string errorMessage;
  auto sdf = [ctx, sdfFunc, &errorOccurred, &errorMessage](manifold::vec3 p) {
    if (errorOccurred) return 0.0;
    JSValue point = JS_NewArray(ctx);
    JS_SetPropertyUint32(ctx, point, 0, JS_NewFloat64(ctx, p.x));
    JS_SetPropertyUint32(ctx, point, 1, JS_NewFloat64(ctx, p.y));
    JS_SetPropertyUint32(ctx, point, 2, JS_NewFloat64(ctx, p.z));
    JSValueConst args[1] = {point};
    JSValue result = JS_Call(ctx, sdfFunc, JS_UNDEFINED, 1, args);
    JS_FreeValue(ctx, point);
    if (JS_IsException(result)) {
      JSValue exc = JS_GetException(ctx);
      JSValue stack = JS_GetPropertyStr(ctx, exc, "stack");
      const char *msg = JS_ToCString(ctx, JS_IsUndefined(stack) ? exc : stack);
      errorOccurred = true;
      errorMessage = msg ? msg : "levelSet SDF threw";
      if (msg) JS_FreeCString(ctx, msg);
      JS_FreeValue(ctx, stack);
      JS_FreeValue(ctx, exc);
      return 0.0;
    }
    double value = 0.0;
    if (JS_ToFloat64(ctx, &value, result) < 0) {
      errorOccurred = true;
      errorMessage = "levelSet SDF must return number";
      JS_FreeValue(ctx, result);
      return 0.0;
    }
    JS_FreeValue(ctx, result);
    return value;
  };

  auto manifoldPtr = std::make_shared<manifold::Manifold>(
      manifold::Manifold::LevelSet(sdf, bounds, edgeLength, level, tolerance,
                                   false));
  JS_FreeValue(ctx, sdfFunc);
  if (errorOccurred) {
    return JS_ThrowInternalError(ctx, "%s", errorMessage.c_str());
  }
  return WrapManifold(ctx, std::move(manifoldPtr));
}

JSValue JsAsOriginal(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "asOriginal expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(target->handle->AsOriginal());
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsOriginalId(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "originalId expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewUint32(ctx, target->handle->OriginalID());
}

JSValue JsReserveIds(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "reserveIds expects count");
  }
  uint32_t count = 0;
  if (JS_ToUint32(ctx, &count, argv[0]) < 0) return JS_EXCEPTION;
  uint32_t base = manifold::Manifold::ReserveIDs(count);
  return JS_NewUint32(ctx, base);
}

JSValue JsNumProperties(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "numProperties expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewInt64(ctx, static_cast<int64_t>(target->handle->NumProp()));
}

JSValue JsNumPropertyVertices(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "numPropertyVertices expects a manifold");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  return JS_NewInt64(ctx, static_cast<int64_t>(target->handle->NumPropVert()));
}

JSValue JsCalculateNormals(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "calculateNormals expects (manifold, normalIdx, minSharpAngle?)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  int32_t normalIdx = 0;
  if (JS_ToInt32(ctx, &normalIdx, argv[1]) < 0) return JS_EXCEPTION;
  double minSharp = 60.0;
  if (argc >= 3 && !JS_IsUndefined(argv[2])) {
    if (JS_ToFloat64(ctx, &minSharp, argv[2]) < 0) return JS_EXCEPTION;
  }
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->CalculateNormals(normalIdx, minSharp));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsCalculateCurvature(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 3) {
    return JS_ThrowTypeError(ctx, "calculateCurvature expects (manifold, gaussianIdx, meanIdx)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  int32_t gaussianIdx = 0;
  int32_t meanIdx = 0;
  if (JS_ToInt32(ctx, &gaussianIdx, argv[1]) < 0) return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &meanIdx, argv[2]) < 0) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->CalculateCurvature(gaussianIdx, meanIdx));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsSmoothByNormals(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 2) {
    return JS_ThrowTypeError(ctx, "smoothByNormals expects (manifold, normalIdx)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  int32_t normalIdx = 0;
  if (JS_ToInt32(ctx, &normalIdx, argv[1]) < 0) return JS_EXCEPTION;
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->SmoothByNormals(normalIdx));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsSmoothOut(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 1) {
    return JS_ThrowTypeError(ctx, "smoothOut expects (manifold, minSharpAngle?, minSmoothness?)");
  }
  JsManifold *target = GetJsManifold(ctx, argv[0]);
  if (!target) return JS_EXCEPTION;
  double minSharp = 60.0;
  double minSmooth = 0.0;
  if (argc >= 2 && !JS_IsUndefined(argv[1])) {
    if (JS_ToFloat64(ctx, &minSharp, argv[1]) < 0) return JS_EXCEPTION;
  }
  if (argc >= 3 && !JS_IsUndefined(argv[2])) {
    if (JS_ToFloat64(ctx, &minSmooth, argv[2]) < 0) return JS_EXCEPTION;
  }
  auto manifold = std::make_shared<manifold::Manifold>(
      target->handle->SmoothOut(minSharp, minSmooth));
  return WrapManifold(ctx, std::move(manifold));
}

JSValue JsMinGap(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
  if (argc < 3) {
    return JS_ThrowTypeError(ctx, "minGap expects (manifoldA, manifoldB, searchLength)");
  }
  JsManifold *a = GetJsManifold(ctx, argv[0]);
  if (!a) return JS_EXCEPTION;
  JsManifold *b = GetJsManifold(ctx, argv[1]);
  if (!b) return JS_EXCEPTION;
  double searchLength = 0.0;
  if (JS_ToFloat64(ctx, &searchLength, argv[2]) < 0) return JS_EXCEPTION;
  return JS_NewFloat64(ctx, a->handle->MinGap(*b->handle, searchLength));
}

void RegisterBindingsInternal(JSContext *ctx) {
  JSValue global = JS_GetGlobalObject(ctx);
  JS_SetPropertyStr(ctx, global, "cube", JS_NewCFunction(ctx, JsCube, "cube", 1));
  JS_SetPropertyStr(ctx, global, "sphere", JS_NewCFunction(ctx, JsSphere, "sphere", 1));
  JS_SetPropertyStr(ctx, global, "cylinder", JS_NewCFunction(ctx, JsCylinder, "cylinder", 1));
  JS_SetPropertyStr(ctx, global, "union", JS_NewCFunction(ctx, JsUnion, "union", 1));
  JS_SetPropertyStr(ctx, global, "difference", JS_NewCFunction(ctx, JsDifference, "difference", 1));
  JS_SetPropertyStr(ctx, global, "intersection", JS_NewCFunction(ctx, JsIntersection, "intersection", 1));
  JS_SetPropertyStr(ctx, global, "translate", JS_NewCFunction(ctx, JsTranslate, "translate", 2));
  JS_SetPropertyStr(ctx, global, "scale", JS_NewCFunction(ctx, JsScale, "scale", 2));
  JS_SetPropertyStr(ctx, global, "rotate", JS_NewCFunction(ctx, JsRotate, "rotate", 2));
  JS_SetPropertyStr(ctx, global, "tetrahedron",
                    JS_NewCFunction(ctx, JsTetrahedron, "tetrahedron", 0));
  JS_SetPropertyStr(ctx, global, "compose",
                    JS_NewCFunction(ctx, JsCompose, "compose", 1));
  JS_SetPropertyStr(ctx, global, "decompose",
                    JS_NewCFunction(ctx, JsDecompose, "decompose", 1));
  JS_SetPropertyStr(ctx, global, "mirror",
                    JS_NewCFunction(ctx, JsMirror, "mirror", 2));
  JS_SetPropertyStr(ctx, global, "transform",
                    JS_NewCFunction(ctx, JsTransform, "transform", 2));
  JS_SetPropertyStr(ctx, global, "setTolerance",
                    JS_NewCFunction(ctx, JsSetTolerance, "setTolerance", 2));
  JS_SetPropertyStr(ctx, global, "simplify",
                    JS_NewCFunction(ctx, JsSimplify, "simplify", 2));
  JS_SetPropertyStr(ctx, global, "refine",
                    JS_NewCFunction(ctx, JsRefine, "refine", 2));
  JS_SetPropertyStr(ctx, global, "refineToLength",
                    JS_NewCFunction(ctx, JsRefineToLength, "refineToLength", 2));
  JS_SetPropertyStr(ctx, global, "refineToTolerance",
                    JS_NewCFunction(ctx, JsRefineToTolerance, "refineToTolerance", 2));
  JS_SetPropertyStr(ctx, global, "hull",
                    JS_NewCFunction(ctx, JsHull, "hull", 1));
  JS_SetPropertyStr(ctx, global, "hullPoints",
                    JS_NewCFunction(ctx, JsHullPoints, "hullPoints", 1));
  JS_SetPropertyStr(ctx, global, "trimByPlane",
                    JS_NewCFunction(ctx, JsTrimByPlane, "trimByPlane", 3));
  JS_SetPropertyStr(ctx, global, "surfaceArea",
                    JS_NewCFunction(ctx, JsSurfaceArea, "surfaceArea", 1));
  JS_SetPropertyStr(ctx, global, "volume",
                    JS_NewCFunction(ctx, JsVolume, "volume", 1));
  JS_SetPropertyStr(ctx, global, "boundingBox",
                    JS_NewCFunction(ctx, JsBoundingBox, "boundingBox", 1));
  JS_SetPropertyStr(ctx, global, "numTriangles",
                    JS_NewCFunction(ctx, JsNumTriangles, "numTriangles", 1));
  JS_SetPropertyStr(ctx, global, "numVertices",
                    JS_NewCFunction(ctx, JsNumVertices, "numVertices", 1));
  JS_SetPropertyStr(ctx, global, "numEdges",
                    JS_NewCFunction(ctx, JsNumEdges, "numEdges", 1));
  JS_SetPropertyStr(ctx, global, "genus",
                    JS_NewCFunction(ctx, JsGenus, "genus", 1));
  JS_SetPropertyStr(ctx, global, "getTolerance",
                    JS_NewCFunction(ctx, JsGetTolerance, "getTolerance", 1));
  JS_SetPropertyStr(ctx, global, "isEmpty",
                    JS_NewCFunction(ctx, JsIsEmpty, "isEmpty", 1));
  JS_SetPropertyStr(ctx, global, "status",
                    JS_NewCFunction(ctx, JsStatus, "status", 1));
  JS_SetPropertyStr(ctx, global, "slice",
                    JS_NewCFunction(ctx, JsSlice, "slice", 2));
  JS_SetPropertyStr(ctx, global, "project",
                    JS_NewCFunction(ctx, JsProject, "project", 1));
  JS_SetPropertyStr(ctx, global, "extrude",
                    JS_NewCFunction(ctx, JsExtrude, "extrude", 2));
  JS_SetPropertyStr(ctx, global, "revolve",
                    JS_NewCFunction(ctx, JsRevolve, "revolve", 2));
  JS_SetPropertyStr(ctx, global, "boolean",
                    JS_NewCFunction(ctx, JsBooleanOp, "boolean", 3));
  JS_SetPropertyStr(ctx, global, "batchBoolean",
                    JS_NewCFunction(ctx, JsBatchBoolean, "batchBoolean", 2));
  JS_SetPropertyStr(ctx, global, "levelSet",
                    JS_NewCFunction(ctx, JsLevelSet, "levelSet", 1));
  JS_SetPropertyStr(ctx, global, "loadMesh",
                    JS_NewCFunction(ctx, JsLoadMesh, "loadMesh", 2));
  JS_SetPropertyStr(ctx, global, "asOriginal",
                    JS_NewCFunction(ctx, JsAsOriginal, "asOriginal", 1));
  JS_SetPropertyStr(ctx, global, "originalId",
                    JS_NewCFunction(ctx, JsOriginalId, "originalId", 1));
  JS_SetPropertyStr(ctx, global, "reserveIds",
                    JS_NewCFunction(ctx, JsReserveIds, "reserveIds", 1));
  JS_SetPropertyStr(ctx, global, "numProperties",
                    JS_NewCFunction(ctx, JsNumProperties, "numProperties", 1));
  JS_SetPropertyStr(ctx, global, "numPropertyVertices",
                    JS_NewCFunction(ctx, JsNumPropertyVertices,
                                     "numPropertyVertices", 1));
  JS_SetPropertyStr(ctx, global, "calculateNormals",
                    JS_NewCFunction(ctx, JsCalculateNormals,
                                     "calculateNormals", 3));
  JS_SetPropertyStr(ctx, global, "calculateCurvature",
                    JS_NewCFunction(ctx, JsCalculateCurvature,
                                     "calculateCurvature", 3));
  JS_SetPropertyStr(ctx, global, "smoothByNormals",
                    JS_NewCFunction(ctx, JsSmoothByNormals,
                                     "smoothByNormals", 2));
  JS_SetPropertyStr(ctx, global, "smoothOut",
                    JS_NewCFunction(ctx, JsSmoothOut, "smoothOut", 3));
  JS_SetPropertyStr(ctx, global, "minGap",
                    JS_NewCFunction(ctx, JsMinGap, "minGap", 3));
  // applyShader(manifold, path) — attaches a matcap path hint to the JS object and returns it
  auto JsApplyShader = [](JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) -> JSValue {
    if (argc < 2) {
      return JS_ThrowTypeError(ctx, "applyShader expects (manifold, path)");
    }
    JsManifold *target = GetJsManifold(ctx, argv[0]);
    if (!target) return JS_EXCEPTION;
    const char *pathStr = JS_ToCString(ctx, argv[1]);
    if (!pathStr) return JS_EXCEPTION;
    JSValue pathJs = JS_NewString(ctx, pathStr);
    JS_FreeCString(ctx, pathStr);
    JS_SetPropertyStr(ctx, const_cast<JSValue &>(argv[0]), "_matcap", pathJs);
    return JS_DupValue(ctx, argv[0]);
  };
  JS_SetPropertyStr(ctx, global, "applyShader",
                    JS_NewCFunction(ctx, JsApplyShader, "applyShader", 2));
  JS_FreeValue(ctx, global);
}

}  // namespace

void EnsureManifoldClass(JSRuntime *runtime) {
  EnsureManifoldClassInternal(runtime);
}

void RegisterBindings(JSContext *ctx) {
  RegisterBindingsInternal(ctx);
}

std::shared_ptr<manifold::Manifold> GetManifoldHandle(JSContext *ctx,
                                                      JSValueConst value) {
  return GetManifoldHandleInternal(ctx, value);
}
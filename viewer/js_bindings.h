#pragma once

extern "C" {
#include "quickjs.h"
}

#include <memory>

namespace manifold {
class Manifold;
}

void EnsureManifoldClass(JSRuntime *runtime);
void RegisterBindings(JSContext *ctx);
std::shared_ptr<manifold::Manifold> GetManifoldHandle(JSContext *ctx,
                                                      JSValueConst value);

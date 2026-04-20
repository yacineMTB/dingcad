#pragma once

#include "types.h"
#include "assembly.h"

extern "C" {
#include "quickjs.h"
}

#include <filesystem>

namespace helscoop {

// Global module loader data (used by main thread)
extern ModuleLoaderData g_moduleLoaderData;

// Module loader callback for QuickJS
JSModuleDef* FilesystemModuleLoader(JSContext* ctx, const char* module_name, void* opaque);

// Load scene from JS file (runs JS + CSG operations)
LoadResult LoadSceneFromFile(JSRuntime* runtime,
                             const std::filesystem::path& path,
                             ModuleLoaderData* loaderData = nullptr);

// Load scene and tessellate in background (creates own JSRuntime, thread-safe)
BackgroundLoadResult LoadAndTessellate(const std::filesystem::path& path);

}  // namespace helscoop

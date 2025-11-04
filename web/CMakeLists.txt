# WebAssembly build configuration for DingCAD
# This builds a version that can run in a browser via GitHub Pages

cmake_minimum_required(VERSION 3.18)
project(dingcad_web LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_C_STANDARD 11)

# Emscripten toolchain
if(NOT DEFINED EMSCRIPTEN)
    set(EMSCRIPTEN "$ENV{EMSCRIPTEN}")
endif()

if(EMSCRIPTEN)
    set(CMAKE_TOOLCHAIN_FILE "${EMSCRIPTEN}/cmake/Modules/Platform/Emscripten.cmake" CACHE PATH "" FORCE)
else()
    message(FATAL_ERROR "Emscripten not found. Set EMSCRIPTEN environment variable or install Emscripten SDK.")
endif()

# Set emscripten flags
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s USE_GLFW=3 -s FULL_ES3=1 -s USE_WEBGL2=1")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=2GB")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','FS','MEMFS']")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s MODULARIZE=1 -s EXPORT_NAME='createDingCADModule'")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s FORCE_FILESYSTEM=1 -s ASSERTIONS=1")

# Disable TBB for web build (not needed for single-threaded web)
set(MANIFOLD_PAR OFF CACHE BOOL "" FORCE)
set(MANIFOLD_TEST OFF CACHE BOOL "" FORCE)
set(MANIFOLD_PYBIND OFF CACHE BOOL "" FORCE)
set(MANIFOLD_JSBIND OFF CACHE BOOL "" FORCE)
set(MANIFOLD_CROSS_SECTION OFF CACHE BOOL "" FORCE)
set(MANIFOLD_EXPORT ON CACHE BOOL "" FORCE)

# Add manifold subdirectory
add_subdirectory(${CMAKE_SOURCE_DIR}/vendor/manifold EXCLUDE_FROM_ALL)

# Build QuickJS for web
add_library(dingcad_quickjs STATIC
  ${CMAKE_SOURCE_DIR}/vendor/quickjs/quickjs.c
  ${CMAKE_SOURCE_DIR}/vendor/quickjs/quickjs-libc.c
  ${CMAKE_SOURCE_DIR}/vendor/quickjs/cutils.c
  ${CMAKE_SOURCE_DIR}/vendor/quickjs/libunicode.c
  ${CMAKE_SOURCE_DIR}/vendor/quickjs/libregexp.c
  ${CMAKE_SOURCE_DIR}/vendor/quickjs/dtoa.c
)

target_include_directories(dingcad_quickjs PUBLIC ${CMAKE_SOURCE_DIR}/vendor/quickjs)
set_target_properties(dingcad_quickjs PROPERTIES LINKER_LANGUAGE C)

# Raylib for web - we'll need to build it with Emscripten
# For now, we'll link against system raylib (if built for web) or use Emscripten port
# The build will need raylib compiled for web separately

# Main viewer executable for web
add_executable(dingcad_viewer_web
  ${CMAKE_SOURCE_DIR}/viewer/main.cpp
  ${CMAKE_SOURCE_DIR}/viewer/js_bindings.cpp
)

target_include_directories(dingcad_viewer_web
  PRIVATE
    ${CMAKE_SOURCE_DIR}/vendor/manifold/include
    ${CMAKE_SOURCE_DIR}/vendor/quickjs
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(dingcad_viewer_web
  PRIVATE
    manifold
    dingcad_quickjs
)

# Set output name
set_target_properties(dingcad_viewer_web PROPERTIES
  OUTPUT_NAME "dingcad_viewer"
  SUFFIX ".js"
)


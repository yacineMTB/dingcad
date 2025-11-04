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

# Get the repository root (one level up from web directory)
get_filename_component(REPO_ROOT "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)

# Add manifold subdirectory (specify binary dir for out-of-tree source)
add_subdirectory(${REPO_ROOT}/vendor/manifold ${CMAKE_BINARY_DIR}/vendor/manifold EXCLUDE_FROM_ALL)

# Build QuickJS for web
add_library(dingcad_quickjs STATIC
  ${REPO_ROOT}/vendor/quickjs/quickjs.c
  ${REPO_ROOT}/vendor/quickjs/quickjs-libc.c
  ${REPO_ROOT}/vendor/quickjs/cutils.c
  ${REPO_ROOT}/vendor/quickjs/libunicode.c
  ${REPO_ROOT}/vendor/quickjs/libregexp.c
  ${REPO_ROOT}/vendor/quickjs/dtoa.c
)

target_include_directories(dingcad_quickjs PUBLIC ${REPO_ROOT}/vendor/quickjs)
set_target_properties(dingcad_quickjs PROPERTIES LINKER_LANGUAGE C)

# Raylib for web - use Emscripten port
# Raylib will be built separately in the GitHub Actions workflow
if(RAYLIB_DIR)
    message(STATUS "Using Raylib from: ${RAYLIB_DIR}")
    # Raylib built with Emscripten creates libraylib.a in the build directory
    # Also check for libraylib.a explicitly
    if(EXISTS "${RAYLIB_DIR}/libraylib.a")
        set(RAYLIB_LIB "${RAYLIB_DIR}/libraylib.a")
        message(STATUS "Found Raylib library at: ${RAYLIB_LIB}")
    else()
        find_library(RAYLIB_LIB 
            NAMES raylib libraylib
            PATHS ${RAYLIB_DIR} ${RAYLIB_DIR}/src ${RAYLIB_DIR}/lib
            NO_DEFAULT_PATH
        )
        if(RAYLIB_LIB)
            message(STATUS "Found Raylib library at: ${RAYLIB_LIB}")
        endif()
    endif()
    
    # Find include directory - Raylib headers are in the source directory
    if(RAYLIB_SRC_DIR)
        set(RAYLIB_INCLUDE_DIR "${RAYLIB_SRC_DIR}/src")
        message(STATUS "Using Raylib source dir for headers: ${RAYLIB_INCLUDE_DIR}")
    else()
        find_path(RAYLIB_INCLUDE_DIR raylib.h
            PATHS ${RAYLIB_DIR}/../src ${RAYLIB_DIR}/../include ${RAYLIB_DIR}/src
            NO_DEFAULT_PATH
        )
        if(RAYLIB_INCLUDE_DIR)
            message(STATUS "Found Raylib headers at: ${RAYLIB_INCLUDE_DIR}")
        endif()
    endif()
else()
    message(WARNING "RAYLIB_DIR not set, will try to find Raylib via standard paths")
endif()

# Main viewer executable for web
add_executable(dingcad_viewer_web
  ${REPO_ROOT}/viewer/main.cpp
  ${REPO_ROOT}/viewer/js_bindings.cpp
)

target_include_directories(dingcad_viewer_web
  PRIVATE
    ${REPO_ROOT}/vendor/manifold/include
    ${REPO_ROOT}/vendor/quickjs
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Add Raylib include directory if found
if(RAYLIB_INCLUDE_DIR)
    target_include_directories(dingcad_viewer_web PRIVATE ${RAYLIB_INCLUDE_DIR})
endif()

target_link_libraries(dingcad_viewer_web
  PRIVATE
    manifold
    dingcad_quickjs
)

# Link Raylib if found
if(RAYLIB_LIB)
    target_link_libraries(dingcad_viewer_web PRIVATE ${RAYLIB_LIB})
else()
    # Try to link via Emscripten port
    target_link_libraries(dingcad_viewer_web PRIVATE raylib)
endif()

# Set output name
set_target_properties(dingcad_viewer_web PROPERTIES
  OUTPUT_NAME "dingcad_viewer"
  SUFFIX ".js"
)


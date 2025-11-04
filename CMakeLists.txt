cmake_minimum_required(VERSION 3.18)
project(dingcad LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_C_STANDARD 11)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Try to find TBB using standard CMake find_package first
find_package(TBB QUIET)

# If not found, try common installation paths
if(NOT TBB_FOUND AND NOT DEFINED TBB_DIR)
  # macOS Homebrew (Apple Silicon)
  if(EXISTS "/opt/homebrew/opt/tbb/lib/cmake/TBB")
    set(TBB_DIR "/opt/homebrew/opt/tbb/lib/cmake/TBB" CACHE PATH "" FORCE)
  # macOS Homebrew (Intel)
  elseif(EXISTS "/usr/local/opt/tbb/lib/cmake/TBB")
    set(TBB_DIR "/usr/local/opt/tbb/lib/cmake/TBB" CACHE PATH "" FORCE)
  # macOS Homebrew (specific version path)
  elseif(EXISTS "/opt/homebrew/Cellar/tbb/2022.2.0/lib/cmake/TBB")
    set(TBB_DIR "/opt/homebrew/Cellar/tbb/2022.2.0/lib/cmake/TBB" CACHE PATH "" FORCE)
  # Linux common paths
  elseif(EXISTS "/usr/lib/cmake/TBB")
    set(TBB_DIR "/usr/lib/cmake/TBB" CACHE PATH "" FORCE)
  elseif(EXISTS "/usr/local/lib/cmake/TBB")
    set(TBB_DIR "/usr/local/lib/cmake/TBB" CACHE PATH "" FORCE)
  endif()
endif()

# Add common TBB paths to CMAKE_PREFIX_PATH if TBB_DIR is set
if(TBB_DIR)
  get_filename_component(TBB_PREFIX "${TBB_DIR}/../.." ABSOLUTE)
  list(APPEND CMAKE_PREFIX_PATH "${TBB_PREFIX}")
else()
  # Fallback: try common installation prefixes
  list(APPEND CMAKE_PREFIX_PATH
    /opt/homebrew/opt/tbb
    /usr/local/opt/tbb
    /usr/local
  )
endif()

# Allow user to override TBB_DIR via environment variable or command line
if(DEFINED ENV{TBB_DIR})
  set(TBB_DIR "$ENV{TBB_DIR}" CACHE PATH "" FORCE)
endif()

set(MANIFOLD_TEST OFF CACHE BOOL "" FORCE)
set(MANIFOLD_PYBIND OFF CACHE BOOL "" FORCE)
set(MANIFOLD_JSBIND OFF CACHE BOOL "" FORCE)
set(MANIFOLD_CROSS_SECTION OFF CACHE BOOL "" FORCE)
set(MANIFOLD_EXPORT ON CACHE BOOL "" FORCE)
set(MANIFOLD_PAR ON CACHE BOOL "" FORCE)

add_subdirectory(vendor/manifold EXCLUDE_FROM_ALL)
add_subdirectory(viewer)

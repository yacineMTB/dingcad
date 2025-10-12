cmake_minimum_required(VERSION 3.18)
project(dingcad LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_C_STANDARD 11)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(NOT DEFINED TBB_DIR)
  if(EXISTS "/opt/homebrew/opt/tbb/lib/cmake/TBB")
    set(TBB_DIR "/opt/homebrew/opt/tbb/lib/cmake/TBB" CACHE PATH "" FORCE)
  elseif(EXISTS "/opt/homebrew/Cellar/tbb/2022.2.0/lib/cmake/TBB")
    set(TBB_DIR "/opt/homebrew/Cellar/tbb/2022.2.0/lib/cmake/TBB" CACHE PATH "" FORCE)
  endif()
endif()

list(APPEND CMAKE_PREFIX_PATH
  /opt/homebrew/opt/tbb
  /opt/homebrew/Cellar/tbb/2022.2.0
)

set(MANIFOLD_TEST OFF CACHE BOOL "" FORCE)
set(MANIFOLD_PYBIND OFF CACHE BOOL "" FORCE)
set(MANIFOLD_JSBIND OFF CACHE BOOL "" FORCE)
set(MANIFOLD_CROSS_SECTION OFF CACHE BOOL "" FORCE)
set(MANIFOLD_EXPORT OFF CACHE BOOL "" FORCE)
set(MANIFOLD_PAR ON CACHE BOOL "" FORCE)

add_subdirectory(vendor/manifold EXCLUDE_FROM_ALL)
add_subdirectory(viewer)

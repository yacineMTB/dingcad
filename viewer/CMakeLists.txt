find_package(raylib 4.0 REQUIRED)

# Generate version header
include(FindGit)
if(GIT_FOUND)
  execute_process(
    COMMAND ${GIT_EXECUTABLE} rev-parse --short HEAD
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
    OUTPUT_VARIABLE GIT_COMMIT
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
  )
else()
  set(GIT_COMMIT "unknown")
endif()

string(TIMESTAMP BUILD_DATE "%Y%m%d-%H%M%S")
set(BUILD_VERSION "${BUILD_DATE}-${GIT_COMMIT}")

configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/version.h.in
  ${CMAKE_CURRENT_BINARY_DIR}/version.h
  @ONLY
)

add_library(dingcad_quickjs STATIC
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/quickjs.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/quickjs-libc.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/cutils.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/libunicode.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/libregexp.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/dtoa.c
)
target_include_directories(dingcad_quickjs PUBLIC ${PROJECT_SOURCE_DIR}/vendor/quickjs)
set_target_properties(dingcad_quickjs PROPERTIES LINKER_LANGUAGE C)

add_executable(dingcad_viewer
  main.cpp
  js_bindings.cpp
)

target_include_directories(dingcad_viewer
  PRIVATE
    ${PROJECT_SOURCE_DIR}/vendor/manifold/include
    ${PROJECT_SOURCE_DIR}/vendor/quickjs
    ${CMAKE_CURRENT_BINARY_DIR}
)

target_link_libraries(dingcad_viewer
  PRIVATE
    manifold
    raylib
    dingcad_quickjs
)

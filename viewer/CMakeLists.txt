find_package(raylib 4.0 REQUIRED)

add_library(dingcad_quickjs STATIC
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/quickjs.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/quickjs-libc.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/cutils.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/libunicode.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/libregexp.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/dtoa.c
)
target_include_directories(dingcad_quickjs PUBLIC ${PROJECT_SOURCE_DIR}/vendor/quickjs)
target_compile_definitions(dingcad_quickjs PRIVATE _GNU_SOURCE)
set_target_properties(dingcad_quickjs PROPERTIES LINKER_LANGUAGE C)

add_library(dingcad_bindings STATIC
  js_bindings.cpp
)

target_link_libraries(dingcad_bindings
  PUBLIC
    dingcad_quickjs
    manifold
)

target_include_directories(dingcad_bindings
  PUBLIC
    ${PROJECT_SOURCE_DIR}/vendor/manifold/include
    ${PROJECT_SOURCE_DIR}/vendor/quickjs
)

add_executable(dingcad_viewer
  main.cpp
)

target_include_directories(dingcad_viewer
  PRIVATE
    ${PROJECT_SOURCE_DIR}/vendor/manifold/include
    ${PROJECT_SOURCE_DIR}/vendor/quickjs
)

target_link_libraries(dingcad_viewer
  PRIVATE
    manifold
    raylib
    dingcad_quickjs
    dingcad_bindings
)

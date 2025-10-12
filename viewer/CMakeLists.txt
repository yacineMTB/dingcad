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
set_target_properties(dingcad_quickjs PROPERTIES LINKER_LANGUAGE C)

add_executable(dingcad_viewer
  main.cpp
  js_bindings.cpp
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
)

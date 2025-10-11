# DingCAD viewer

find_package(raylib 4.0 REQUIRED)

add_library(dingcad_quickjs STATIC
  ${PROJECT_SOURCE_DIR}/quickjs/quickjs.c
  ${PROJECT_SOURCE_DIR}/quickjs/quickjs-libc.c
  ${PROJECT_SOURCE_DIR}/quickjs/cutils.c
  ${PROJECT_SOURCE_DIR}/quickjs/libunicode.c
  ${PROJECT_SOURCE_DIR}/quickjs/libregexp.c
  ${PROJECT_SOURCE_DIR}/quickjs/dtoa.c
)
target_include_directories(dingcad_quickjs PUBLIC ${PROJECT_SOURCE_DIR}/quickjs)
set_target_properties(dingcad_quickjs PROPERTIES LINKER_LANGUAGE C)

add_executable(dingcad
  main.cpp
)

target_link_libraries(dingcad
  PRIVATE
    manifold
    raylib
    dingcad_quickjs
)

target_include_directories(dingcad
  PRIVATE
    ${PROJECT_SOURCE_DIR}/include
)

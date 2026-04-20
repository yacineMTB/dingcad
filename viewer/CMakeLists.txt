find_package(raylib 4.0 REQUIRED)

add_library(helscoop_quickjs STATIC
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/quickjs.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/quickjs-libc.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/cutils.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/libunicode.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/libregexp.c
  ${PROJECT_SOURCE_DIR}/vendor/quickjs/dtoa.c
)
target_include_directories(helscoop_quickjs PUBLIC ${PROJECT_SOURCE_DIR}/vendor/quickjs)
set_target_properties(helscoop_quickjs PROPERTIES LINKER_LANGUAGE C)

add_executable(helscoop_viewer
  main.cpp
  js_bindings.cpp
  file_utils.cpp
  mesh_utils.cpp
  scene_loader.cpp
  material_loader.cpp
  ui_panels.cpp
  thermal.cpp
  climate_data.cpp
  structural.cpp
  ifc_export.cpp
  blueprint_export.cpp
  assembly.cpp
  primitives/wall.cpp
)

target_include_directories(helscoop_viewer
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${PROJECT_SOURCE_DIR}/vendor/manifold/include
    ${PROJECT_SOURCE_DIR}/vendor/quickjs
    ${PROJECT_SOURCE_DIR}/vendor
)

target_link_libraries(helscoop_viewer
  PRIVATE
    manifold
    raylib
    helscoop_quickjs
)

# Link OpenGL framework on macOS for direct GL function access
if(APPLE)
  target_link_libraries(helscoop_viewer PRIVATE "-framework OpenGL")
  target_link_libraries(helscoop_viewer PRIVATE "-framework ApplicationServices")
  target_compile_definitions(helscoop_viewer PRIVATE GL_SILENCE_DEPRECATION)
endif()

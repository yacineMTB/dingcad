add_executable(js_bindings_smoke
  js_bindings_smoke.cpp
)

target_link_libraries(js_bindings_smoke
  PRIVATE
    dingcad_bindings
)

target_include_directories(js_bindings_smoke
  PRIVATE
    ${PROJECT_SOURCE_DIR}/viewer
)

add_test(NAME js_bindings_smoke COMMAND js_bindings_smoke)

add_executable(js_bindings_geometry
  js_bindings_geometry.cpp
)

target_link_libraries(js_bindings_geometry
  PRIVATE
    dingcad_bindings
)

target_include_directories(js_bindings_geometry
  PRIVATE
    ${PROJECT_SOURCE_DIR}/viewer
)

add_test(NAME js_bindings_geometry COMMAND js_bindings_geometry)

add_executable(js_bindings_properties
  js_bindings_properties.cpp
)

target_link_libraries(js_bindings_properties
  PRIVATE
    dingcad_bindings
)

target_include_directories(js_bindings_properties
  PRIVATE
    ${PROJECT_SOURCE_DIR}/viewer
)

add_test(NAME js_bindings_properties COMMAND js_bindings_properties)

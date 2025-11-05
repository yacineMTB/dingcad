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

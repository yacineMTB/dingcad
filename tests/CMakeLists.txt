add_executable(js_bindings_smoke
  js_bindings_smoke.cpp
)

target_link_libraries(js_bindings_smoke
  PRIVATE
    dingcad_quickjs
    manifold
)

target_include_directories(js_bindings_smoke
  PRIVATE
    ${PROJECT_SOURCE_DIR}/viewer
    ${PROJECT_SOURCE_DIR}/vendor/quickjs
    ${PROJECT_SOURCE_DIR}/vendor/manifold/include
)

add_test(NAME js_bindings_smoke COMMAND js_bindings_smoke)

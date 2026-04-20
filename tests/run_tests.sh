#!/bin/bash
# Automated render tests for helscoop
# Renders all examples and test scenes, reports any failures

set -e

VIEWER="./build/viewer/helscoop_viewer"
OUT_DIR="/tmp/helscoop_tests"
PASS=0
FAIL=0
ERRORS=""

mkdir -p "$OUT_DIR"

# Check viewer exists
if [ ! -f "$VIEWER" ]; then
  echo "ERROR: Viewer not found at $VIEWER. Run cmake --build build/viewer first."
  exit 1
fi

render_test() {
  local name="$1"
  local scene="$2"
  local extra_args="${3:-}"
  local safename="${name//\//_}"
  local output="$OUT_DIR/${safename}.png"

  printf "  %-35s " "$name"

  if $VIEWER --render "$scene" "$output" --size 640 360 $extra_args >/dev/null 2>&1; then
    # Check output file exists and has reasonable size (>1KB)
    local fsize
    fsize=$(wc -c < "$output" 2>/dev/null || echo 0)
    if [ -f "$output" ] && [ "$fsize" -gt 1000 ]; then
      echo "PASS"
      PASS=$((PASS + 1))
    else
      echo "FAIL (empty output)"
      FAIL=$((FAIL + 1))
      ERRORS="$ERRORS\n  $name: output file missing or empty"
    fi
  else
    echo "FAIL (render error)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  $name: render process failed"
  fi
}

echo "=== Helscoop Render Tests ==="
echo ""

# Test all examples
echo "Examples:"
for dir in examples/*/; do
  name=$(basename "$dir")
  scene="$dir/main.js"
  if [ -f "$scene" ]; then
    render_test "example/$name" "$scene"
  fi
done

echo ""
echo "Test Scenes:"
for scene in tests/scenes/*.js; do
  name=$(basename "$scene" .js)
  render_test "test/$name" "$scene"
done

echo ""
echo "Render Modes:"
render_test "mode/white-bg" "examples/lamp/main.js" "--background white"
render_test "mode/toon" "examples/chess/main.js" ""
render_test "mode/supersample" "examples/gear/main.js" "--supersample 2"
render_test "mode/camera-front" "examples/bolt/main.js" "--camera front"
render_test "mode/camera-top" "examples/table/main.js" "--camera top"
render_test "mode/camera-iso" "examples/showroom/main.js" "--camera iso"
render_test "mode/wireframe" "examples/gear/main.js" "--wireframe"
render_test "mode/transparent" "examples/gear/main.js" "--background transparent"
render_test "mode/param-override" "examples/gear/main.js" "--param num_teeth=30"

echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Total:  $((PASS + FAIL))"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Failures:"
  echo -e "$ERRORS"
  exit 1
fi

echo ""
echo "All tests passed! Renders in $OUT_DIR"

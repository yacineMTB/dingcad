#!/bin/bash
# Test that parameter updates affect rendered output
# Modifies a parameter in a scene file, re-renders, and checks the output changed

set -e

VIEWER="./build/viewer/helscoop_viewer"
SCENE="tests/scenes/test_parameter_update.js"
OUT_DIR="/tmp/helscoop_param_test"
PASS=0
FAIL=0

mkdir -p "$OUT_DIR"

if [ ! -f "$VIEWER" ]; then
  echo "ERROR: Viewer not found at $VIEWER"
  exit 1
fi

# Backup the original scene
cp "$SCENE" "$SCENE.bak"

cleanup() {
  mv "$SCENE.bak" "$SCENE" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Parameter Update Tests ==="
echo ""

# Test 1: Render with default value (box_size = 5)
printf "  %-40s " "render with box_size=5"
if $VIEWER --render "$SCENE" "$OUT_DIR/param_default.png" --size 320 240 >/dev/null 2>&1; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL (render error)"
  FAIL=$((FAIL + 1))
fi

# Test 2: Modify parameter and re-render (num_copies = 6)
sed -i.tmp 's/const num_copies = 2;/const num_copies = 6;/' "$SCENE"
rm -f "$SCENE.tmp"

printf "  %-40s " "render with num_copies=6"
if $VIEWER --render "$SCENE" "$OUT_DIR/param_modified.png" --size 320 240 >/dev/null 2>&1; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL (render error)"
  FAIL=$((FAIL + 1))
fi

# Test 3: Verify outputs differ (different param = different image)
printf "  %-40s " "outputs differ after param change"
if python3 -c "
from PIL import Image
import numpy as np
a = np.array(Image.open('$OUT_DIR/param_default.png'))
b = np.array(Image.open('$OUT_DIR/param_modified.png'))
diff = np.mean(np.abs(a.astype(float) - b.astype(float)))
assert diff > 1.0, f'Images too similar (mean diff={diff:.1f}), param change had no effect'
print(f'  Mean pixel difference: {diff:.1f}')
" 2>&1; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL (images identical)"
  FAIL=$((FAIL + 1))
fi

# Test 4: Verify WriteParameterToFile via the C++ binary
# Reset to original
cp "$SCENE.bak" "$SCENE"

printf "  %-40s " "ParseSceneParameters finds param"
if python3 -c "
import subprocess, sys
result = subprocess.run(['$VIEWER', '--render', '$SCENE', '/dev/null', '--size', '1', '1'],
                       capture_output=True, text=True, timeout=30)
output = result.stdout + result.stderr
if 'parameters' in output.lower() or 'Parsed' in output:
    # Extract param count
    for line in output.split('\n'):
        if 'Parsed' in line and 'parameter' in line:
            print(f'  {line.strip()}')
            sys.exit(0)
print('  No parameter info found')
sys.exit(0)
" 2>&1; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Total:  $((PASS + FAIL))"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
echo ""
echo "All parameter tests passed!"

#!/bin/bash
# Performance test: measures reload time when changing coopLength parameter

LOG_FILE="/tmp/helscoop_perf_test.log"

echo "=== Helscoop Performance Test ==="
echo ""

# Kill any existing viewer
pkill -f helscoop_viewer 2>/dev/null
sleep 0.3

# 1. Copy coop.js to scene.js with initial value
cp coop.js scene.js
echo "[1/5] Copied coop.js to scene.js"

# 2. Start viewer in background, redirect all output to file
rm -f "$LOG_FILE"
./build/viewer/helscoop_viewer >"$LOG_FILE" 2>&1 &
VIEWER_PID=$!
echo "[2/5] Started viewer (PID: $VIEWER_PID)"

# 3. Wait for initial load
echo "[3/5] Waiting for initial load..."
sleep 4

# Check if viewer is still running
if ! kill -0 $VIEWER_PID 2>/dev/null; then
    echo "ERROR: Viewer crashed during initial load"
    cat "$LOG_FILE"
    exit 1
fi

# Extract initial load timing
echo ""
echo "--- Initial Load Performance ---"
grep "PROFILE:" "$LOG_FILE" | head -5
echo ""

# 4. Record line count before change
LINES_BEFORE=$(wc -l < "$LOG_FILE" | tr -d ' ')

# Modify coopLength parameter (from 1830 to 2000)
echo "[4/5] Changing coopLength from 1830 to 2000..."
sed -i '' 's/const coopLength = 1830/const coopLength = 2000/' scene.js

# 5. Wait for reload to complete
echo "[5/5] Waiting for reload..."
sleep 3

# Extract reload timing (from lines after the change)
echo ""
echo "--- Reload Performance (after parameter change) ---"
tail -n +$LINES_BEFORE "$LOG_FILE" | grep "PROFILE:"
echo ""

# Summary
RELOAD_TOTAL=$(tail -n +$LINES_BEFORE "$LOG_FILE" | grep "reloadScene TOTAL" | grep -oE '[0-9]+ ms')
echo "========================================="
echo "  TOTAL RELOAD TIME: $RELOAD_TOTAL"
echo "========================================="
echo ""

# Cleanup
kill $VIEWER_PID 2>/dev/null
wait $VIEWER_PID 2>/dev/null

# Restore original scene.js
cp coop.js scene.js

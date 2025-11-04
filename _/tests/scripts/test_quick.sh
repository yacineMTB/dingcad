#!/bin/bash
# Quick test runner - runs a single test file with better output

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <test_file.js>"
    exit 1
fi

TEST_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
VIEWER_BIN="$BUILD_DIR/viewer/dingcad_viewer"

if [[ ! -f "$TEST_FILE" ]]; then
    echo "Error: Test file not found: $TEST_FILE"
    exit 1
fi

if [[ ! -x "$VIEWER_BIN" ]]; then
    echo "Building viewer..."
    cd "$PROJECT_ROOT"
    make build || exit 1
fi

echo "Running test: $TEST_FILE"
echo "---"

# Create temp file with helpers
TEMP_FILE=$(mktemp)
cat > "$TEMP_FILE" << 'TESTHELPERS'
// Test helper functions
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function print(message) {
    // Output will be captured
}

TESTHELPERS

# Append test file
cat "$TEST_FILE" >> "$TEMP_FILE"

# Run test
if "$VIEWER_BIN" "$TEMP_FILE" 2>&1; then
    echo "---"
    echo "✓ Test passed"
    rm -f "$TEMP_FILE"
    exit 0
else
    echo "---"
    echo "✗ Test failed"
    rm -f "$TEMP_FILE"
    exit 1
fi


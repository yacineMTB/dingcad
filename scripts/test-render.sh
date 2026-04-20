#!/bin/bash
# Test rendering script for helscoop
# Usage: ./scripts/test-render.sh [scene.js] [output.png]

set -e  # Exit on error

HELSCOOP_VIEWER="./build/viewer/helscoop_viewer"

# Check if viewer is built
if [ ! -f "$HELSCOOP_VIEWER" ]; then
    echo "Error: helscoop_viewer not found. Run 'cmake --build build' first."
    exit 1
fi

# Default scene and output
SCENE="${1:-test_colors.js}"
OUTPUT="${2:-tests/test_output.png}"

echo "Rendering scene: $SCENE"
echo "Output: $OUTPUT"

# Create output directory if needed
mkdir -p "$(dirname "$OUTPUT")"

# Render the scene
$HELSCOOP_VIEWER --render "$SCENE" "$OUTPUT"

# Check if output was created (raylib may save to cwd, so check both locations)
OUTPUT_BASENAME=$(basename "$OUTPUT")
if [ -f "$OUTPUT" ]; then
    echo "✓ Render successful: $OUTPUT"
    ls -lh "$OUTPUT"
elif [ -f "$OUTPUT_BASENAME" ]; then
    echo "✓ Render successful: $OUTPUT_BASENAME (saved to working directory)"
    ls -lh "$OUTPUT_BASENAME"
    OUTPUT="$OUTPUT_BASENAME"  # Update for reference check

    # Check if reference image exists for comparison
    REFERENCE="tests/reference/$(basename "$OUTPUT")"
    if [ -f "$REFERENCE" ]; then
        echo ""
        echo "Reference image exists: $REFERENCE"
        echo "To compare images visually, open both files."
        echo "To update reference: cp $OUTPUT $REFERENCE"
    else
        echo ""
        echo "No reference image found at: $REFERENCE"
        echo "To create reference: cp $OUTPUT $REFERENCE"
    fi
else
    echo "✗ Render failed: Output file not created"
    exit 1
fi

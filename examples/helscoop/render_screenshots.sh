#!/bin/bash
# Generate screenshots of the chicken coop from different angles
# Usage: ./render_screenshots.sh [output_dir]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VIEWER="$SCRIPT_DIR/../../build/viewer/helscoop_viewer"
SCENE="$SCRIPT_DIR/scene.js"
OUTPUT_DIR="${1:-$SCRIPT_DIR/screenshots}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Generating coop screenshots to: $OUTPUT_DIR"
echo "Using viewer: $VIEWER"
echo "Scene: $SCENE"
echo ""

# Define views as simple arrays: name yaw pitch [dist]
VIEWS=(
  # Perspective views from corners
  "view_01_front_right 0.7 0.35"
  "view_02_front_left 2.4 0.35"
  "view_03_back_right -0.7 0.35"
  "view_04_back_left -2.4 0.35"

  # Cardinal directions (straight on)
  "view_05_front 1.571 0.3"
  "view_06_back -1.571 0.3"
  "view_07_left 3.14159 0.3"
  "view_08_right 0 0.3"

  # High angle views
  "view_09_aerial_front 1.571 0.8"
  "view_10_aerial_corner 0.7 0.9"

  # Low angle views
  "view_11_ground_front 1.571 0.1"
  "view_12_ground_corner 0.7 0.1"

  # Detail views (closer distance)
  "view_13_run_detail -0.3 0.25 6"
  "view_14_entrance_detail 1.571 0.2 5"
  "view_15_nest_box_detail 2.8 0.2 5"
)

# Generate each view
for view in "${VIEWS[@]}"; do
  # Parse the view string
  read -r name yaw pitch dist <<< "$view"

  output="$OUTPUT_DIR/${name}.png"

  # Build args
  args="--yaw $yaw --pitch $pitch"
  if [ -n "$dist" ]; then
    args="$args --dist $dist"
  fi

  echo "Rendering: $name (yaw=$yaw, pitch=$pitch${dist:+, dist=$dist})"
  cd "$SCRIPT_DIR"
  "$VIEWER" --render "$SCENE" "$output" --size 1024 768 $args 2>/dev/null

  if [ -f "$output" ]; then
    echo "  -> Saved: $output"
  else
    echo "  -> FAILED: $output"
  fi
done

echo ""
echo "Done! Generated $(ls -1 "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ') screenshots."
echo "Output directory: $OUTPUT_DIR"

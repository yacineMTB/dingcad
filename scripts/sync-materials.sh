#!/bin/bash
# Sync materials from Helscoop API to local materials.json for the C++ viewer
# Usage: ./scripts/sync-materials.sh [API_URL]

API_URL="${1:-http://localhost:3001}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$SCRIPT_DIR/materials/materials.json"

echo "Syncing materials from $API_URL..."
curl -sf "$API_URL/materials/export/viewer" | python3 -m json.tool > "$OUTPUT.tmp"

if [ $? -eq 0 ] && [ -s "$OUTPUT.tmp" ]; then
  mv "$OUTPUT.tmp" "$OUTPUT"
  MATS=$(python3 -c "import json; print(len(json.load(open('$OUTPUT'))['materials']))")
  echo "Synced $MATS materials to $OUTPUT"
else
  rm -f "$OUTPUT.tmp"
  echo "Error: Failed to fetch materials from $API_URL" >&2
  exit 1
fi

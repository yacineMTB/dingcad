#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$ROOT_DIR/build"

cmake -S "$ROOT_DIR" -B "$BUILD_DIR"
cmake --build "$BUILD_DIR" --target dingcad_viewer

VIEWER_BIN="$BUILD_DIR/viewer/dingcad_viewer"

if [[ ! -x "$VIEWER_BIN" ]];
then
  echo "viewer executable not found at $VIEWER_BIN" >&2
  exit 1
fi

"$VIEWER_BIN" "$@"

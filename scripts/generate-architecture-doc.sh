#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIEWER_BIN="$ROOT_DIR/build/viewer/helscoop_viewer"

SCENE_INPUT="${1:-$ROOT_DIR/scene.js}"
OUT_DIR_INPUT="${2:-$ROOT_DIR/renders/architecture_doc_$(date +%Y%m%d_%H%M%S)}"
SHOT_FILE_INPUT="${3:-$ROOT_DIR/scripts/archdoc_shots.tsv}"

WIDTH="${ARCHDOC_WIDTH:-1920}"
HEIGHT="${ARCHDOC_HEIGHT:-1080}"
CAPTURE_FRAMES="${ARCHDOC_CAPTURE_FRAMES:-6}"
SHOW_UI="${ARCHDOC_SHOW_UI:-0}"
TIMEOUT_SEC="${ARCHDOC_TIMEOUT_SEC:-45}"
PRECHECK_TIMEOUT_SEC="${ARCHDOC_PRECHECK_TIMEOUT_SEC:-30}"
SKIP_PREFLIGHT="${ARCHDOC_SKIP_PREFLIGHT:-0}"

resolve_path() {
  local path="$1"
  if [[ "$path" = /* ]]; then
    printf "%s\n" "$path"
  else
    printf "%s\n" "$PWD/$path"
  fi
}

SCENE_PATH="$(resolve_path "$SCENE_INPUT")"
OUT_DIR="$(resolve_path "$OUT_DIR_INPUT")"
SHOT_FILE="$(resolve_path "$SHOT_FILE_INPUT")"
PRECHECK_LOG="$OUT_DIR/preflight.log"

if [[ ! -f "$SCENE_PATH" ]]; then
  echo "Scene not found: $SCENE_PATH" >&2
  exit 1
fi

if [[ ! -f "$SHOT_FILE" ]]; then
  echo "Shot file not found: $SHOT_FILE" >&2
  exit 1
fi

if [[ ! -x "$VIEWER_BIN" ]]; then
  echo "Building helscoop_viewer..."
  cmake -S "$ROOT_DIR" -B "$ROOT_DIR/build"
  cmake --build "$ROOT_DIR/build" --target helscoop_viewer
fi

run_with_timeout() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "$TIMEOUT_SEC" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$TIMEOUT_SEC" "$@"
  elif command -v perl >/dev/null 2>&1; then
    perl -e 'alarm shift @ARGV; exec @ARGV' "$TIMEOUT_SEC" "$@"
  else
    "$@"
  fi
}

print_render_failure_help() {
  echo "Render startup failed before first frame."
  echo
  echo "Most common cause: no active desktop graphics session (headless/SSH/sandboxed shell)."
  echo "The viewer currently needs a real OpenGL window context to render screenshots."
  echo
  echo "Try:"
  echo "  1) Run from a logged-in desktop session (not CI/headless shell)."
  echo "  2) If on macOS, run from Terminal.app while the GUI session is active."
  echo "  3) Validate with: ./build/viewer/helscoop_viewer --render scene.js /tmp/probe.png --frames 1 --hide-ui"
  if [[ -f "$PRECHECK_LOG" ]]; then
    echo
    echo "Preflight log: $PRECHECK_LOG"
    sed -n '1,80p' "$PRECHECK_LOG"
  fi
}

preflight_render() {
  local probe_name="__probe.png"
  local probe_file="$OUT_DIR/images/$probe_name"
  local probe_fallback="$ROOT_DIR/$probe_name"
  local log_file="$PRECHECK_LOG"
  local precheck_timeout="$PRECHECK_TIMEOUT_SEC"
  if [[ "$TIMEOUT_SEC" -lt "$precheck_timeout" ]]; then
    precheck_timeout="$TIMEOUT_SEC"
  fi

  local cmd=(
    "$VIEWER_BIN"
    --render "$SCENE_PATH" "$probe_name"
    --size 320 180
    --yaw 40
    --pitch 20
    --dist-scale 1.0
    --frames 1
  )
  if [[ "$SHOW_UI" == "1" ]]; then
    cmd+=(--show-ui)
  else
    cmd+=(--hide-ui)
  fi

  local status=0
  if command -v timeout >/dev/null 2>&1; then
    if (cd "$ROOT_DIR" && timeout "$precheck_timeout" "${cmd[@]}") >"$log_file" 2>&1; then
      status=0
    else
      status=$?
    fi
  elif command -v gtimeout >/dev/null 2>&1; then
    if (cd "$ROOT_DIR" && gtimeout "$precheck_timeout" "${cmd[@]}") >"$log_file" 2>&1; then
      status=0
    else
      status=$?
    fi
  elif command -v perl >/dev/null 2>&1; then
    if (cd "$ROOT_DIR" && perl -e 'alarm shift @ARGV; exec @ARGV' "$precheck_timeout" "${cmd[@]}") >"$log_file" 2>&1; then
      status=0
    else
      status=$?
    fi
  else
    if (cd "$ROOT_DIR" && "${cmd[@]}") >"$log_file" 2>&1; then
      status=0
    else
      status=$?
    fi
  fi

  if [[ -f "$probe_fallback" ]]; then
    mv -f "$probe_fallback" "$probe_file"
  fi

  if [[ "$status" -ne 0 || ! -f "$probe_file" ]]; then
    rm -f "$probe_file"
    rm -f "$probe_fallback"
    return 1
  fi
  rm -f "$probe_file"
  rm -f "$probe_fallback"
  return 0
}

mkdir -p "$OUT_DIR/images"
MANIFEST="$OUT_DIR/shot_manifest.tsv"
: > "$MANIFEST"

echo "Architecture doc render pipeline"
echo "Scene: $SCENE_PATH"
echo "Shots: $SHOT_FILE"
echo "Output: $OUT_DIR"
echo "Mode: live render"
echo

if [[ "$SKIP_PREFLIGHT" == "1" ]]; then
  echo "Skipping render preflight (ARCHDOC_SKIP_PREFLIGHT=1)."
  echo
else
  echo "Running render preflight..."
  if ! preflight_render; then
    print_render_failure_help >&2
    exit 1
  fi
  echo "Preflight passed."
  echo
fi

shot_index=0
ok_count=0
fail_count=0
fatal_render_failure=0

while IFS='|' read -r id section title yaw pitch dist_scale target_off_x target_off_y target_off_z fov notes render_flags layout; do
  [[ -z "${id// }" ]] && continue
  [[ "${id:0:1}" == "#" ]] && continue

  shot_index=$((shot_index + 1))
  printf -v shot_tag "%02d_%s" "$shot_index" "$id"
  output_name="${shot_tag}.png"
  image_rel="images/${shot_tag}.png"
  image_abs="$OUT_DIR/$image_rel"

  echo "[$shot_index] $title"
  cmd=(
    "$VIEWER_BIN"
    --render "$SCENE_PATH" "$output_name"
    --size "$WIDTH" "$HEIGHT"
    --yaw "$yaw"
    --pitch "$pitch"
    --dist-scale "$dist_scale"
    --target-offset "$target_off_x" "$target_off_y" "$target_off_z"
    --fov "$fov"
    --frames "$CAPTURE_FRAMES"
  )

  if [[ "$SHOW_UI" == "1" ]]; then
    cmd+=(--show-ui)
  else
    cmd+=(--hide-ui)
  fi

  if [[ -n "${render_flags:-}" ]]; then
    IFS=',' read -ra flag_items <<< "$render_flags"
    for raw_flag in "${flag_items[@]}"; do
      flag="$(echo "$raw_flag" | xargs)"
      case "$flag" in
        "" )
          ;;
        focus_material:* )
          mat_id="${flag#focus_material:}"
          [[ -n "$mat_id" ]] && cmd+=(--focus-material "$mat_id")
          ;;
        focus_object:* )
          obj_id="${flag#focus_object:}"
          [[ -n "$obj_id" ]] && cmd+=(--focus-object "$obj_id")
          ;;
        focus_category:* )
          cat_id="${flag#focus_category:}"
          [[ -n "$cat_id" ]] && cmd+=(--focus-category "$cat_id")
          ;;
        cam_pos:* )
          cam_vals="${flag#cam_pos:}"
          IFS=':' read -r cx cy cz <<< "$cam_vals"
          if [[ -n "${cx:-}" && -n "${cy:-}" && -n "${cz:-}" ]]; then
            cmd+=(--camera-pos "$cx" "$cy" "$cz")
          fi
          ;;
        cam_look:* )
          look_vals="${flag#cam_look:}"
          IFS=':' read -r lx ly lz <<< "$look_vals"
          if [[ -n "${lx:-}" && -n "${ly:-}" && -n "${lz:-}" ]]; then
            cmd+=(--look-at "$lx" "$ly" "$lz")
          fi
          ;;
        "interior_cutaway" )
          cmd+=(--interior-cutaway)
          ;;
        "hide_mesh" )
          cmd+=(--hide-material hardware_cloth)
          ;;
        "hide_insulation" )
          cmd+=(--hide-material insulation_100mm)
          cmd+=(--hide-material vapor_barrier)
          ;;
        "hide_finish" )
          cmd+=(--hide-category finish)
          ;;
        "hide_roofing" )
          cmd+=(--hide-category roofing)
          ;;
        "hide_sheathing" )
          cmd+=(--hide-category sheathing)
          ;;
        hide_object:* )
          obj_id="${flag#hide_object:}"
          [[ -n "$obj_id" ]] && cmd+=(--hide-object "$obj_id")
          ;;
        show_object:* )
          obj_id="${flag#show_object:}"
          [[ -n "$obj_id" ]] && cmd+=(--show-object "$obj_id")
          ;;
        * )
          echo "  WARN: unknown render flag '$flag' (ignored)"
          ;;
      esac
    done
  fi

  if (cd "$ROOT_DIR" && run_with_timeout "${cmd[@]}"); then
    status=0
  else
    status=$?
  fi

  # raylib screenshot path behavior: when an absolute path is passed, it may still save in cwd
  # using basename only. Move that fallback output into the report image folder.
  fallback_output="$ROOT_DIR/$output_name"
  if [[ -f "$fallback_output" && ! -f "$image_abs" ]]; then
    mv -f "$fallback_output" "$image_abs"
  fi

  if [[ "$status" -ne 0 ]]; then
    echo "  FAILED (render command error)"
    fail_count=$((fail_count + 1))
    if [[ "$status" -eq 124 ]]; then
      echo "  Render timed out after ${TIMEOUT_SEC}s; aborting remaining shots."
      fatal_render_failure=1
      break
    fi
    if (( ok_count == 0 )); then
      fatal_render_failure=1
      break
    fi
    continue
  fi

  if [[ ! -f "$image_abs" ]]; then
    echo "  FAILED (image missing: $image_abs)"
    fail_count=$((fail_count + 1))
    continue
  fi

  printf "%s|%s|%s|%s|%s|%s\n" \
    "$id" "$section" "$title" "$image_rel" "$notes" "${layout:-}" >> "$MANIFEST"
  ok_count=$((ok_count + 1))
done < "$SHOT_FILE"

if (( ok_count == 0 )); then
  echo
  if (( fatal_render_failure == 1 )); then
    print_render_failure_help >&2
  fi
  echo "No shots rendered successfully." >&2
  exit 1
fi

REPORT_MD="$OUT_DIR/ARCHITECTURE_REPORT.md"
REPORT_HTML="$OUT_DIR/architecture_report.html"
REPORT_HTML_MAG="$OUT_DIR/architecture_report_magazine.html"
default_project_name="$(basename "$(dirname "$SCENE_PATH")" | sed -E 's/[_-]+/ /g' | sed -E 's/(^| )([a-z])/\1\U\2/g')"
PROJECT_NAME="${ARCHDOC_PROJECT_NAME:-$default_project_name}"
TEMPLATE_HTML_PATH="${ARCHDOC_TEMPLATE_PATH:-$ROOT_DIR/scripts/assets/architecture_report14_template.html}"

{
  echo "# Architecture Visual Report"
  echo
  echo "- Generated: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
  echo "- Scene: \`$SCENE_PATH\`"
  echo "- Shot Preset: \`$SHOT_FILE\`"
  echo "- Capture Mode: live render"
  echo "- Resolution: ${WIDTH}x${HEIGHT}"
  echo "- Successful Renders: $ok_count"
  echo "- Failed Renders: $fail_count"
  echo

  current_section=""
  while IFS='|' read -r _id section title image_rel notes _layout; do
    if [[ "$section" != "$current_section" ]]; then
      echo "## $section"
      echo
      current_section="$section"
    fi
    echo "### $title"
    echo
    echo "![${title}](${image_rel})"
    echo
    echo "$notes"
    echo
  done < "$MANIFEST"
} > "$REPORT_MD"

# Always emit the modern magazine report variant.
python3 "$ROOT_DIR/scripts/render_report_magazine.py" \
  "$MANIFEST" "$REPORT_HTML_MAG" "$SCENE_PATH" "$WIDTH" "$HEIGHT" "$ok_count" "$fail_count" "$PROJECT_NAME"

# If a preferred template exists, render from that template as the primary HTML output.
# This keeps a stable visual language for publishing workflows.
if [[ -f "$TEMPLATE_HTML_PATH" ]]; then
  python3 "$ROOT_DIR/scripts/render_report_from_template.py" \
    "$MANIFEST" "$TEMPLATE_HTML_PATH" "$REPORT_HTML" "$PROJECT_NAME" "$ok_count" "$fail_count" "$SCENE_PATH"
else
  cp "$REPORT_HTML_MAG" "$REPORT_HTML"
fi


echo
echo "Done."
echo "Markdown report: $REPORT_MD"
echo "HTML report:     $REPORT_HTML"
echo "HTML magazine:   $REPORT_HTML_MAG"
echo "Rendered shots:  $ok_count ok / $fail_count failed"

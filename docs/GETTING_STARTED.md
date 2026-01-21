# Dingcad Documentation

## Overview
Dingcad is a live reloading CAD playground that stitches together the [manifold](https://github.com/elalish/manifold) geometry kernel, [QuickJS](https://bellard.org/quickjs/) for scripting, and a [raylib](https://www.raylib.com/) viewer. Scene geometry is described in JavaScript, converted to manifolds with the bindings in `viewer/js_bindings.cpp`, and rendered with custom toon plus outline shaders. The viewer watches your scene and its imported modules, so edits are reflected moments after you save.

## Project Layout
* `run.sh`: bootstrap script that configures CMake, builds, and launches the viewer.
* `scene.js`: default entry point that must `export const scene` (a manifold). The viewer will fall back to a demo if it cannot load this file.
* `library/`: reusable JavaScript helpers and component generators for scenes.
* `viewer/`: C++ viewer, bindings, and shaders.
* `vendor/`: checked in copies of QuickJS and Manifold; initialize them through git submodules.

## Prerequisites
* C++17 toolchain and CMake ≥ 3.18.
* [`raylib` 4.x](https://github.com/raysan5/raylib). Install via your package manager (for example `brew install raylib`).
* [`tbb`](https://www.intel.com/content/www/us/en/developer/tools/oneapi/onetbb.html) (required by manifold). Typical packages such as `brew install tbb` work.
* Git submodules initialised by running `git submodule update` with both the init and recursive long options. Each option uses two leading minus characters.

Manifold and QuickJS are vendored; you do **not** need to install them separately once the submodules are in place.

## Getting Started
1. Clone the repository and initialise dependencies:
   ```sh
   git clone <repository_url>
   cd dingcad
   git submodule update
   ```
   Add the init and recursive long options to the last command so that every nested repository is available.
2. Install `raylib` and `tbb` via your preferred package manager.
3. Build and launch:
   ```sh
   ./run.sh
   ```
   The script configures CMake, builds `dingcad_viewer`, and launches it. Pass the help flag to `./run.sh` if you need viewer command line options.

Subsequent runs only rebuild when sources change. To clean, remove the `build/` directory manually or invoke the `cmake` build tool with the build target set to `clean`.

## Editing Scenes
1. Point the viewer at a script (defaults to `scene.js` in the current directory or home folder). The module must export `scene`:
   ```js
   import { makeWidget } from './library/widget.js';

   const base = cube({ size: [20, 30, 5], center: true });
   export const scene = difference(base, makeWidget());
   ```
2. Use the provided bindings (`cube`, `sphere`, `difference`, `union`, `translate`, `rotate`, `scale`, `hull`, `extrude`, `slice`, etc.) defined in `viewer/js_bindings.cpp`. Functions return handles to `manifold::Manifold` objects.
3. Required data structures:
   * Vectors are arrays (for example `[x, y, z]`).
   * Transforms are twelve element arrays describing a 3x4 matrix.
4. Save the file; `dingcad_viewer` detects changes to the entry script and any imported modules and reloads automatically. Press `R` to force a reload if necessary.

## Viewer Controls
* **Orbit**: left mouse drag.
* **Pan**: right mouse drag.
* **Zoom**: scroll wheel.
* **Move focus**: `WASDQE` (moves the target point).
* **Reset camera**: `Space`.
* **Export STL**: press `P` to write `ding.stl` into your `~/Downloads` directory (or the current directory if `$HOME` is unset).

The renderer applies a 0.1 scale factor (`kSceneScale`) when converting from scene units to the viewer. By convention the JavaScript scene uses millimetres; adjust if your workflow prefers different units.

## Troubleshooting
* **Missing raylib or TBB**: ensure the libraries are discoverable by CMake. On macOS, Homebrew installs are auto detected; otherwise set `CMAKE_PREFIX_PATH` or `TBB_DIR` manually.
* **Stale geometry**: confirm `scene.js` exports a non empty manifold and that no exception is thrown in the script (errors appear in the terminal). Press `R` to reload the scene.
* **Submodule errors**: rerun the recursive git submodule update command and check that `vendor/manifold` and `vendor/quickjs` contain sources.

For deeper dives, read `viewer/js_bindings.cpp` to discover the entire JavaScript API and `viewer/main.cpp` for renderer behaviour.

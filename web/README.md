# DingCAD Web Build

This directory contains the WebAssembly build configuration for DingCAD, allowing it to run in a browser.

## Building Locally

### Prerequisites

1. **Install Emscripten SDK:**
   ```bash
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. **Install dependencies:**
   ```bash
   # Same as regular build
   sudo apt install build-essential cmake libtbb-dev
   # Plus X11/OpenGL for Raylib
   sudo apt install libgl1-mesa-dev libx11-dev libxrandr-dev libxi-dev libxcursor-dev libxinerama-dev
   ```

3. **Build Raylib for web:**
   ```bash
   cd /tmp
   git clone --depth 1 --branch 5.0 https://github.com/raysan5/raylib.git
   cd raylib
   mkdir build && cd build
   emcmake cmake .. -DBUILD_SHARED_LIBS=ON
   emmake make -j$(nproc)
   sudo emmake make install
   ```

### Build Steps

```bash
# From project root
source $EMSDK/emsdk_env.sh  # If not already in your shell

mkdir -p build-web
cd build-web
emcmake cmake ../web
emmake make -j$(nproc)
```

Output will be in `build-web/`:
- `dingcad_viewer.js` - JavaScript wrapper
- `dingcad_viewer.wasm` - WebAssembly binary

## Running Locally

1. **Serve the files:**
   ```bash
   # Using Python
   cd build-web
   python3 -m http.server 8000
   
   # Or using Node.js
   npx http-server build-web
   ```

2. **Open in browser:**
   ```
   http://localhost:8000/index.html
   ```

## GitHub Pages Deployment

The web build is automatically deployed to GitHub Pages via GitHub Actions:

- **Live URL:** `https://<username>.github.io/dingcad/`
- **Commit-specific:** `https://<username>.github.io/dingcad/commits/<sha>/index.html?commit=<full-sha>`

### Accessing Specific Commits

You can access any commit's build by:
1. Going to the commit in GitHub
2. Clicking "Actions" tab
3. Finding the web build artifact
4. Or using: `https://<username>.github.io/dingcad/commits/<short-sha>/index.html?commit=<full-sha>`

## Features

- ✅ Full 3D rendering in browser
- ✅ Interactive camera controls (mouse drag to rotate, scroll to zoom)
- ✅ Code editor for editing scenes
- ✅ Example scenes
- ✅ Commit-specific builds
- ✅ Works on desktop and mobile browsers

## Limitations

- File system access is virtual (Emscripten MEMFS)
- No file watching (manual reload required)
- Larger initial load (WebAssembly bundle)
- Some performance differences vs native

## Development

To modify the web build:

1. Edit `web/CMakeLists.txt` for build configuration
2. Edit `web/index.html` for UI/UX
3. Modify `viewer/main.cpp` to add web-specific code (use `#ifdef __EMSCRIPTEN__`)

## Troubleshooting

### Build fails with "Emscripten not found"
- Ensure Emscripten SDK is installed and activated
- Run `source $EMSDK/emsdk_env.sh` before building

### Raylib not found
- Build Raylib for Emscripten (see Prerequisites)
- Set `RAYLIB_DIR` if installed in non-standard location

### Module fails to load in browser
- Check browser console for errors
- Ensure server is serving with correct MIME types
- Check that `.wasm` files are being served correctly


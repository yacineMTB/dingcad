# Web Build Setup Status

## ✅ What's Been Created

1. **Web Build Configuration** (`web/CMakeLists.txt`)
   - Emscripten toolchain setup
   - WebAssembly compilation flags
   - QuickJS and Manifold library configuration

2. **GitHub Actions Workflow** (`.github/workflows/build-web.yml`)
   - Automatically builds WebAssembly version on push/PR
   - Builds Raylib for WebAssembly
   - Deploys to GitHub Pages
   - Creates commit-specific builds

3. **HTML Interface** (`web/index.html`, `web/simple.html`)
   - Browser-based UI
   - Code editor for editing scenes
   - Interactive 3D viewer
   - Commit information display

4. **Makefile Target** (`make web`)
   - Local web build command
   - Requires Emscripten SDK

## 🚧 What Still Needs Work

### 1. Main.cpp Web Compatibility

The current `viewer/main.cpp` needs modifications for web:

- **File System**: Replace `std::filesystem` with Emscripten's virtual filesystem (MEMFS)
- **Window Management**: Raylib's web platform handles this differently
- **Module Loading**: Adapt JavaScript module loading for browser context
- **File Watching**: Remove or replace with browser-based alternatives

### 2. Raylib Web Build

Raylib needs to be compiled specifically for WebAssembly:
- Use `PLATFORM=PLATFORM_WEB` when building
- Or use Raylib's web-specific build system
- May need to use raylib-html5 or similar

### 3. JavaScript Bindings

The JS bindings need to work with:
- Browser's JavaScript context (not QuickJS in browser)
- Or keep QuickJS but bridge properly with browser JS

## 📝 Next Steps

### Option 1: Full WebAssembly Port (Recommended for full functionality)

1. Create `viewer/main_web.cpp` that:
   - Uses Emscripten's filesystem API
   - Adapts window creation for web
   - Implements browser-based scene loading
   - Bridges QuickJS with browser JavaScript

2. Modify CMakeLists.txt to conditionally build web version

3. Test locally with Emscripten SDK

### Option 2: Simplified Web Version (Faster to implement)

1. Create a JavaScript-only version that:
   - Uses Three.js or similar for rendering
   - Runs scene code in browser JavaScript
   - Provides same API surface

2. This would be a separate implementation but faster to deploy

## 🌐 Accessing Web Builds

Once the build is working, you'll be able to access:

- **Latest master:** `https://wes321.github.io/dingcad/`
- **Specific commit:** `https://wes321.github.io/dingcad/commits/<sha>/index.html?commit=<full-sha>`
- **Via URL parameter:** `?commit=<sha>` to load specific version

## 🔧 Local Testing

```bash
# Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Build
make web

# Serve
cd build-web
python3 -m http.server 8000
# Open http://localhost:8000/index.html
```

## 📚 Resources

- [Emscripten Documentation](https://emscripten.org/docs/getting_started/index.html)
- [Raylib Web Platform](https://github.com/raysan5/raylib/wiki/raylib-for-web)
- [WebAssembly Guide](https://webassembly.org/)

---

**Status:** Infrastructure created, compilation needs refinement for full functionality.


// Web-specific entry point for DingCAD
// This replaces the desktop main() with a web-compatible version

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#endif

#include "viewer/main.cpp"

// Forward declaration - we'll implement a web-compatible main
extern "C" {
    // Export function to load scene from JavaScript
    EMSCRIPTEN_KEEPALIVE
    void loadSceneFromCode(const char* code) {
        // Implementation will be added to main.cpp
    }
}

// Web version of main - called after module initialization
int main_web() {
    // Initialize the viewer for web
    // This will be similar to desktop main() but adapted for browser
    return 0;
}


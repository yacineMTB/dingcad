.PHONY: help init build run clean configure all check-deps test test-unit test-integration test-scenes test-performance test-syntax dev web web-check web-needs-rebuild kill-port

# Variables
BUILD_DIR := build
ROOT_DIR := $(shell pwd)
VIEWER_BIN := $(BUILD_DIR)/viewer/dingcad_viewer

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "DingCAD Makefile Commands:"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Examples:"
	@echo "  make init          # Initialize git submodules"
	@echo "  make build         # Configure and build the project"
	@echo "  make run           # Build and run the viewer"
	@echo "  make clean         # Remove build directory"

init: ## Initialize and update git submodules (manifold and quickjs)
	@echo "Initializing git submodules..."
	git submodule update --init --recursive
	@echo "✓ Submodules initialized"

check-deps: ## Check if required dependencies are installed
	@echo "Checking dependencies..."
	@command -v cmake >/dev/null 2>&1 || { echo "✗ cmake is required but not installed"; exit 1; }
	@command -v git >/dev/null 2>&1 || { echo "✗ git is required but not installed"; exit 1; }
	@pkg-config --exists raylib 2>/dev/null || { echo "⚠ Warning: raylib not found via pkg-config. Make sure it's installed."; }
	@echo "✓ Basic dependencies check passed"

configure: init ## Configure CMake build system
	@echo "Configuring CMake build..."
	cmake -S "$(ROOT_DIR)" -B "$(BUILD_DIR)"
	@echo "✓ CMake configuration complete"

build: configure ## Build the project (configure if needed)
	@echo "Building project..."
	cmake --build "$(BUILD_DIR)" --target dingcad_viewer
	@if [ ! -x "$(VIEWER_BIN)" ]; then \
		echo "✗ Viewer executable not found at $(VIEWER_BIN)"; \
		exit 1; \
	fi
	@echo "✓ Build complete: $(VIEWER_BIN)"

run: build ## Build and run the viewer
	@echo "Running viewer..."
	"$(VIEWER_BIN)" $(ARGS)

all: clean build ## Clean, configure, and build everything

clean: ## Remove build directories
	@echo "Cleaning build directories..."
	rm -rf "$(BUILD_DIR)" build-web
	@echo "✓ Clean complete (removed build and build-web)"

clean-all: clean ## Remove build directory and submodule checkouts (use with caution)
	@echo "This will remove vendor submodules. Continue? [y/N]" && read ans && [ $${ans:-N} = y ] || exit 1
	rm -rf vendor/manifold vendor/quickjs
	@echo "✓ All clean (including submodules)"

test: build ## Run all tests and generate JSON/markdown results
	@echo "Running all tests..."
	@./_/tests/scripts/run_tests.sh

test-unit: build ## Run unit tests only
	@echo "Running unit tests..."
	@for test in _/tests/unit/*.js; do \
		if [ -f "$$test" ]; then \
			echo "Running $$test"; \
			"$(VIEWER_BIN)" "$$test" > /dev/null 2>&1 && echo "✓ $$test" || echo "✗ $$test"; \
		fi \
	done

test-integration: build ## Run integration tests only
	@echo "Running integration tests..."
	@for test in _/tests/integration/*.js; do \
		if [ -f "$$test" ]; then \
			echo "Running $$test"; \
			"$(VIEWER_BIN)" "$$test" > /dev/null 2>&1 && echo "✓ $$test" || echo "✗ $$test"; \
		fi \
	done

test-scenes: build ## Run scene tests only
	@echo "Running scene tests..."
	@for test in _/tests/scenes/*.js; do \
		if [ -f "$$test" ]; then \
			echo "Running $$test"; \
			"$(VIEWER_BIN)" "$$test" > /dev/null 2>&1 && echo "✓ $$test" || echo "✗ $$test"; \
		fi \
	done

test-performance: build ## Run performance tests only
	@echo "Running performance tests..."
	@for test in _/tests/performance/*.js; do \
		if [ -f "$$test" ]; then \
			echo "Running $$test"; \
			"$(VIEWER_BIN)" "$$test" > /dev/null 2>&1 && echo "✓ $$test" || echo "✗ $$test"; \
		fi \
	done

test-syntax: ## Check syntax of all test files
	@echo "Checking test file syntax..."
	@./_/tests/scripts/test_syntax.sh

yacine: ## Sync fork with upstream (yacineMTB/dingcad) and create PR with test results
	@echo "Syncing fork with upstream and creating PR..."
	@./_/scripts/sync-fork-pr.sh

# Source files that affect the WASM build
# Include all C++ source files, headers, and CMakeLists that affect the build
WEB_SOURCES := viewer/main.cpp viewer/js_bindings.cpp viewer/js_bindings.h web/web_main.cpp web/CMakeLists.txt web/quickjs_emscripten_compat.c web/quickjs_emscripten_compat.h viewer/version.h.in
WEB_OUTPUT := build-web/dingcad_viewer.js build-web/dingcad_viewer.wasm

# Check if WASM needs to be rebuilt (returns 0 if up to date, 1 if rebuild needed)
web-needs-rebuild:
	@if [ ! -f "build-web/dingcad_viewer.js" ] || [ ! -f "build-web/dingcad_viewer.wasm" ]; then \
		echo "⚠ WASM files not found, rebuild needed"; \
		exit 1; \
	fi
	@for src in $(WEB_SOURCES); do \
		if [ -f "$$src" ] && [ "$$src" -nt "build-web/dingcad_viewer.js" ]; then \
			echo "⚠ Source file $$src is newer than WASM, rebuild needed"; \
			exit 1; \
		fi; \
	done
	@exit 0

web: ## Build WebAssembly version for browser (requires Emscripten)
	@echo "Building WebAssembly version..."
	@if ! command -v emcc &> /dev/null; then \
		echo "✗ Emscripten not found."; \
		echo ""; \
		echo "Run the setup script to install Emscripten:"; \
		echo "  ./setup-dev.sh"; \
		echo ""; \
		echo "Or install manually:"; \
		echo "  https://emscripten.org/docs/getting_started/downloads.html"; \
		exit 1; \
	fi
	@mkdir -p build-web
	@RAYLIB_DIR="$${RAYLIB_DIR:-/tmp/raylib-web/build}"; \
	RAYLIB_SRC_DIR="$${RAYLIB_SRC_DIR:-/tmp/raylib-web}"; \
	export RAYLIB_DIR RAYLIB_SRC_DIR; \
	if [ ! -f "$$RAYLIB_DIR/raylib/libraylib.a" ]; then \
		echo "⚠ Raylib web build not found at $$RAYLIB_DIR/raylib/libraylib.a"; \
		echo "   Run ./setup-dev.sh to build Raylib for web"; \
		exit 1; \
	fi; \
	echo "Using Raylib: $$RAYLIB_DIR"; \
	cd build-web && \
		if [ -n "$$EMSDK" ] && [ -f "$$EMSDK/emsdk_env.sh" ]; then \
			source "$$EMSDK/emsdk_env.sh" 2>/dev/null || true; \
		elif [ -f "$(HOME)/emsdk/emsdk_env.sh" ]; then \
			source "$(HOME)/emsdk/emsdk_env.sh" 2>/dev/null || true; \
		fi && \
		if [ -f "CMakeCache.txt" ] && [ "../web/CMakeLists.txt" -nt "CMakeCache.txt" ]; then \
			echo "⚠ CMakeLists.txt changed, forcing reconfigure..."; \
			rm -f CMakeCache.txt; \
		fi && \
		emcmake cmake ../web \
			-DRAYLIB_DIR="$$RAYLIB_DIR" \
			-DRAYLIB_SRC_DIR="$$RAYLIB_SRC_DIR" && \
		if command -v nproc &> /dev/null; then \
			emmake make -j$$(nproc); \
		else \
			emmake make -j$$(sysctl -n hw.ncpu 2>/dev/null || echo 4); \
		fi
	@echo "Copying latest web files to build-web (always fresh)..."
	@cp -f web/index.html build-web/index.html 2>/dev/null || true
	@cp -f web/simple.html build-web/simple.html 2>/dev/null || true
	@cp -f _/config/library-manifest.json build-web/library-manifest.json 2>/dev/null || echo "⚠ Warning: library-manifest.json not found - run 'make library-manifest' first"
	@echo "Copying library folder to build-web..."
	@rm -rf build-web/library 2>/dev/null || true
	@cp -r library build-web/library 2>/dev/null || echo "⚠ Warning: library folder not found"
	@echo "✓ Files copied to build-web"
	@echo "✓ Web build complete: build-web/dingcad_viewer.js"
	@echo "  Serve with: cd build-web && python3 -m http.server 8000"

web-check: ## Check if WASM needs rebuild and rebuild if necessary
	@if ! make -s web-needs-rebuild 2>/dev/null; then \
		echo "🔄 Rebuilding WASM (source files changed)..."; \
		make web; \
	else \
		echo "✓ WASM is up to date"; \
	fi

kill-port: ## Kill any process using port 8000 (or specify PORT=XXXX)
	@PORT=$${PORT:-8000}; \
	echo "🔪 Killing processes on port $$PORT..."; \
	if lsof -ti:$$PORT >/dev/null 2>&1; then \
		echo "⚠️  Found processes using port $$PORT:"; \
		lsof -ti:$$PORT | while read pid; do \
			echo "   PID $$pid: $$(ps -p $$pid -o comm= 2>/dev/null || echo 'unknown')"; \
		done; \
		lsof -ti:$$PORT | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
		if lsof -ti:$$PORT >/dev/null 2>&1; then \
			echo "⚠️  Some processes still using port $$PORT, trying again..."; \
			lsof -ti:$$PORT | xargs kill -9 2>/dev/null || true; \
			sleep 1; \
		fi; \
		if lsof -ti:$$PORT >/dev/null 2>&1; then \
			echo "❌ Failed to kill all processes on port $$PORT"; \
			echo "   Please manually kill processes using: lsof -ti:$$PORT | xargs kill -9"; \
			exit 1; \
		else \
			echo "✓ Port $$PORT is now free"; \
		fi; \
	else \
		echo "✓ Port $$PORT is already free"; \
	fi

dev: ## Build web version and start development server (kills port, cleans, and rebuilds)
	@echo "🧹 Cleaning build directories..."
	@rm -rf build-web
	@echo "✓ Clean complete"
	@echo ""
	@echo "🔪 Killing any existing server on port 8000..."
	@PORT=8000; \
	MAX_ATTEMPTS=5; \
	ATTEMPT=0; \
	while [ $$ATTEMPT -lt $$MAX_ATTEMPTS ]; do \
		if lsof -ti:$$PORT >/dev/null 2>&1; then \
			echo "⚠️  Port $$PORT is in use (attempt $$((ATTEMPT + 1))), killing processes..."; \
			lsof -ti:$$PORT | xargs kill -9 2>/dev/null || true; \
			sleep 2; \
			ATTEMPT=$$((ATTEMPT + 1)); \
		else \
			echo "✓ Port $$PORT is free"; \
			break; \
		fi; \
	done; \
	if lsof -ti:$$PORT >/dev/null 2>&1; then \
		echo "❌ Failed to free port $$PORT after $$MAX_ATTEMPTS attempts"; \
		echo "   Please manually kill processes using: lsof -ti:$$PORT | xargs kill -9"; \
		exit 1; \
	fi
	@echo ""
	@echo "🔨 Building web version..."
	@make web
	@echo ""
	@echo "📋 Copying latest web files to build-web (always fresh)..."
	@cp -f web/index.html build-web/index.html 2>/dev/null || true
	@cp -f web/simple.html build-web/simple.html 2>/dev/null || true
	@cp -f _/config/library-manifest.json build-web/library-manifest.json 2>/dev/null || echo "⚠ Warning: library-manifest.json not found - run 'make library-manifest' first"
	@echo "Copying library folder to build-web..."
	@rm -rf build-web/library 2>/dev/null || true
	@cp -r library build-web/library 2>/dev/null || echo "⚠ Warning: library folder not found"
	@echo "✓ Files updated in build-web"
	@if [ ! -f "build-web/server.py" ]; then \
		echo "Creating no-cache server script..."; \
		echo '#!/usr/bin/env python3' > build-web/server.py; \
		echo '"""Simple HTTP server with no caching for development"""' >> build-web/server.py; \
		echo 'import http.server' >> build-web/server.py; \
		echo 'import socketserver' >> build-web/server.py; \
		echo 'import sys' >> build-web/server.py; \
		echo 'import subprocess' >> build-web/server.py; \
		echo 'import os' >> build-web/server.py; \
		echo 'from http.server import SimpleHTTPRequestHandler' >> build-web/server.py; \
		echo '' >> build-web/server.py; \
		echo 'def kill_port(port):' >> build-web/server.py; \
		echo '    """Kill any process using the specified port"""' >> build-web/server.py; \
		echo '    try:' >> build-web/server.py; \
		echo '        if sys.platform == "darwin":  # macOS' >> build-web/server.py; \
		echo '            result = subprocess.run([' >> build-web/server.py; \
		echo '                "lsof", "-ti", f":{port}"' >> build-web/server.py; \
		echo '            ], capture_output=True, text=True)' >> build-web/server.py; \
		echo '            if result.returncode == 0 and result.stdout.strip():' >> build-web/server.py; \
		echo '                pids = result.stdout.strip().split()' >> build-web/server.py; \
		echo '                for pid in pids:' >> build-web/server.py; \
		echo '                    try:' >> build-web/server.py; \
		echo '                        subprocess.run(["kill", "-9", pid], check=False)' >> build-web/server.py; \
		echo '                        print(f"🔪 Killed process {pid} on port {port}")' >> build-web/server.py; \
		echo '                    except:' >> build-web/server.py; \
		echo '                        pass' >> build-web/server.py; \
		echo '        elif sys.platform.startswith("linux"):  # Linux' >> build-web/server.py; \
		echo '            result = subprocess.run([' >> build-web/server.py; \
		echo '                "lsof", "-ti", f":{port}"' >> build-web/server.py; \
		echo '            ], capture_output=True, text=True)' >> build-web/server.py; \
		echo '            if result.returncode == 0 and result.stdout.strip():' >> build-web/server.py; \
		echo '                pids = result.stdout.strip().split()' >> build-web/server.py; \
		echo '                for pid in pids:' >> build-web/server.py; \
		echo '                    try:' >> build-web/server.py; \
		echo '                        subprocess.run(["kill", "-9", pid], check=False)' >> build-web/server.py; \
		echo '                        print(f"🔪 Killed process {pid} on port {port}")' >> build-web/server.py; \
		echo '                    except:' >> build-web/server.py; \
		echo '                        pass' >> build-web/server.py; \
		echo '    except Exception as e:' >> build-web/server.py; \
		echo '        print(f"⚠️  Warning: Could not check port {port}: {e}")' >> build-web/server.py; \
		echo '' >> build-web/server.py; \
		echo 'class NoCacheHTTPRequestHandler(SimpleHTTPRequestHandler):' >> build-web/server.py; \
		echo '    def end_headers(self):' >> build-web/server.py; \
		echo '        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")' >> build-web/server.py; \
		echo '        self.send_header("Pragma", "no-cache")' >> build-web/server.py; \
		echo '        self.send_header("Expires", "0")' >> build-web/server.py; \
		echo '        super().end_headers()' >> build-web/server.py; \
		echo '' >> build-web/server.py; \
		echo 'if __name__ == "__main__":' >> build-web/server.py; \
		echo '    PORT = int(os.environ.get("PORT", "8000"))' >> build-web/server.py; \
		echo '    kill_port(PORT)' >> build-web/server.py; \
		echo '    try:' >> build-web/server.py; \
		echo '        with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:' >> build-web/server.py; \
		echo '            print(f"🚀 Server running at http://localhost:{PORT}/")' >> build-web/server.py; \
		echo '            print("📝 No caching enabled - files will always reload fresh")' >> build-web/server.py; \
		echo '            print("Press Ctrl+C to stop")' >> build-web/server.py; \
		echo '            httpd.serve_forever()' >> build-web/server.py; \
		echo '    except OSError as e:' >> build-web/server.py; \
		echo '        if e.errno == 48 or "Address already in use" in str(e):' >> build-web/server.py; \
		echo '            print(f"❌ Port {PORT} is still in use after kill attempt")' >> build-web/server.py; \
		echo '            print(f"   Please manually kill: lsof -ti:{PORT} | xargs kill -9")' >> build-web/server.py; \
		echo '            sys.exit(1)' >> build-web/server.py; \
		echo '        else:' >> build-web/server.py; \
		echo '            raise' >> build-web/server.py; \
		chmod +x build-web/server.py; \
	fi
	@echo ""
	@PORT=8000; \
	echo "🔍 Final port check before starting server..."; \
	if lsof -ti:$$PORT >/dev/null 2>&1; then \
		echo "⚠️  Port $$PORT still in use, force killing..."; \
		lsof -ti:$$PORT | xargs kill -9 2>/dev/null || true; \
		sleep 2; \
	fi; \
	if lsof -ti:$$PORT >/dev/null 2>&1; then \
		echo "❌ Port $$PORT is still in use. Please manually kill processes:"; \
		echo "   lsof -ti:$$PORT | xargs kill -9"; \
		exit 1; \
	fi; \
	echo "✓ Port $$PORT confirmed free"; \
	echo ""; \
	echo "🚀 Starting development server (NO CACHE) on http://localhost:$$PORT"; \
	echo "   Open http://localhost:$$PORT/index.html in your browser"; \
	echo "   Press Ctrl+C to stop"; \
	echo ""; \
	cd build-web && \
		if [ -f "server.py" ]; then \
			python3 server.py; \
		elif command -v python3 &> /dev/null; then \
			python3 -m http.server $$PORT; \
		elif command -v python &> /dev/null; then \
			python -m SimpleHTTPServer $$PORT; \
		else \
			echo "✗ Python not found. Please install Python 3."; \
			exit 1; \
		fi

check-workflow: ## Check latest GitHub Actions workflow status and auto-fix errors
	@echo "Checking GitHub Actions workflow status..."
	@./_/scripts/check-and-fix-workflow.sh

check-workflow-web: ## Check and fix web build workflow specifically
	@echo "Checking web build workflow..."
	@./_/scripts/check-and-fix-workflow.sh "Build Web Version"


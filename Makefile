.PHONY: help init build run clean configure all check-deps test test-unit test-integration test-scenes test-performance test-syntax

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

clean: ## Remove build directory
	@echo "Cleaning build directory..."
	rm -rf "$(BUILD_DIR)"
	@echo "✓ Clean complete"

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

web: ## Build WebAssembly version for browser (requires Emscripten)
	@echo "Building WebAssembly version..."
	@if ! command -v emcc &> /dev/null; then \
		echo "✗ Emscripten not found. Install: https://emscripten.org/docs/getting_started/downloads.html"; \
		exit 1; \
	fi
	@mkdir -p build-web
	@cd build-web && source $$EMSDK/emsdk_env.sh 2>/dev/null || true && \
		emcmake cmake ../web && \
		emmake make -j$$(nproc)
	@echo "✓ Web build complete: build-web/dingcad_viewer.js"
	@echo "  Serve with: cd build-web && python3 -m http.server 8000"


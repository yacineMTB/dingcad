# Build Instructions

This document provides comprehensive build instructions for DingCAD on all supported platforms.

## Prerequisites

### Required Dependencies

1. **CMake** (version 3.18 or higher)
   - macOS: `brew install cmake`
   - Linux: `sudo apt install cmake` (Debian/Ubuntu) or equivalent
   - Windows: Download from [cmake.org](https://cmake.org/download/)

2. **C++ Compiler** (C++17 support required)
   - macOS: Xcode Command Line Tools (`xcode-select --install`)
   - Linux: `g++` or `clang++` (usually pre-installed)
   - Windows: Visual Studio 2019 or later with C++ support

3. **Raylib** (version 4.0 or higher)
   - macOS: `brew install raylib`
   - Linux: `sudo apt install libraylib-dev` (or equivalent)
   - Windows: Install via vcpkg or build from source

4. **Intel TBB** (Threading Building Blocks)
   - macOS: `brew install tbb`
   - Linux: `sudo apt install libtbb-dev` (or equivalent)
   - Windows: Install via vcpkg or download from Intel

5. **Git** (for submodules)
   - Usually pre-installed on macOS/Linux
   - Windows: Install from [git-scm.com](https://git-scm.com/)

### Optional Dependencies

- **Ninja** (faster builds): `brew install ninja` or `sudo apt install ninja-build`

## Quick Start

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd dingcad

# Initialize submodules
make init

# Build the project
make build

# Run the viewer
make run
```

## Detailed Build Steps

### Step 1: Initialize Submodules

The project uses git submodules for vendor dependencies (manifold and quickjs).

```bash
make init
# or manually:
git submodule update --init --recursive
```

### Step 2: Check Dependencies

Verify that all required dependencies are installed:

```bash
make check-deps
```

This will check for:
- CMake
- Git
- Raylib (via pkg-config)

**Note:** TBB detection happens during CMake configuration.

### Step 3: Configure Build

The Makefile automatically configures CMake, but you can do it manually:

```bash
make configure
# or manually:
cmake -S . -B build
```

#### Custom Configuration Options

**Specify TBB Location:**
```bash
TBB_DIR=/custom/path/to/tbb/lib/cmake/TBB cmake -S . -B build
```

**Use Ninja instead of Make:**
```bash
cmake -S . -B build -G Ninja
```

**Build Type (Debug/Release):**
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
```

### Step 4: Build

```bash
make build
# or manually:
cmake --build build --target dingcad_viewer
```

**Parallel Build:**
```bash
cmake --build build --target dingcad_viewer -j$(nproc)  # Linux
cmake --build build --target dingcad_viewer -j$(sysctl -n hw.ncpu)  # macOS
```

### Step 5: Run

```bash
make run
# or manually:
./build/viewer/dingcad_viewer
```

The viewer will look for `scene.js` in the current directory or `$HOME`.

## Platform-Specific Instructions

### macOS

#### Using Homebrew (Recommended)

```bash
# Install dependencies
brew install cmake raylib tbb

# Build
make init
make build
make run
```

#### Manual TBB Setup

If TBB is installed in a non-standard location:

```bash
export TBB_DIR=/path/to/tbb/lib/cmake/TBB
make build
```

### Linux

#### Debian/Ubuntu

```bash
# Install dependencies
sudo apt update
sudo apt install cmake build-essential libraylib-dev libtbb-dev

# Build
make init
make build
make run
```

#### Fedora/RHEL

```bash
# Install dependencies
sudo dnf install cmake gcc-c++ raylib-devel tbb-devel

# Build
make init
make build
make run
```

#### Arch Linux

```bash
# Install dependencies
sudo pacman -S cmake raylib tbb

# Build
make init
make build
make run
```

### Windows

#### Using vcpkg (Recommended)

```bash
# Install vcpkg (if not already installed)
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat

# Install dependencies
.\vcpkg install raylib tbb

# Build (from dingcad directory)
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE=[vcpkg root]/scripts/buildsystems/vcpkg.cmake
cmake --build build --config Release
```

#### Manual Setup

1. Install CMake from [cmake.org](https://cmake.org/download/)
2. Install Raylib:
   - Download from [raylib.com](https://www.raylib.com/)
   - Or build from source
3. Install TBB:
   - Download from [Intel TBB](https://www.intel.com/content/www/us/en/developer/tools/oneapi/onetbb.html)
   - Or use vcpkg
4. Set `TBB_DIR` environment variable:
   ```cmd
   set TBB_DIR=C:\path\to\tbb\lib\cmake\TBB
   ```
5. Build:
   ```cmd
   cmake -S . -B build
   cmake --build build --config Release
   ```

## Troubleshooting

### TBB Not Found

**Error:** `Could not find TBB`

**Solutions:**
1. Install TBB via package manager:
   - macOS: `brew install tbb`
   - Linux: `sudo apt install libtbb-dev` (or equivalent)
2. Set `TBB_DIR` environment variable:
   ```bash
   export TBB_DIR=/path/to/tbb/lib/cmake/TBB
   cmake -S . -B build
   ```
3. Use CMake variable:
   ```bash
   cmake -S . -B build -DTBB_DIR=/path/to/tbb/lib/cmake/TBB
   ```

### Raylib Not Found

**Error:** `Could not find raylib`

**Solutions:**
1. Install raylib via package manager:
   - macOS: `brew install raylib`
   - Linux: `sudo apt install libraylib-dev` (or equivalent)
2. If raylib is installed but not found:
   ```bash
   export CMAKE_PREFIX_PATH=/path/to/raylib:$CMAKE_PREFIX_PATH
   cmake -S . -B build
   ```

### Submodule Issues

**Error:** `fatal: reference is not a tree`

**Solutions:**
```bash
# Clean and reinitialize submodules
rm -rf vendor/manifold vendor/quickjs
git submodule update --init --recursive
```

### Build Failures

**Error:** Compilation errors

**Solutions:**
1. Clean build directory:
   ```bash
   make clean
   make build
   ```
2. Check compiler version (needs C++17 support):
   ```bash
   g++ --version  # Should be 7.0+ or clang 5.0+
   ```
3. Verify all dependencies are installed:
   ```bash
   make check-deps
   ```

### Font Issues

**Issue:** Font not loading correctly

**Solutions:**
- Font loading is optional - the application will fall back to default font
- Install Consolas font if you want the custom branding font
- Font paths are automatically detected on all platforms

## Makefile Commands

Run `make help` to see all available commands:

```bash
make help          # Show all available commands
make init          # Initialize git submodules
make check-deps    # Check required dependencies
make configure     # Configure CMake build
make build         # Build the project
make run           # Build and run the viewer
make clean         # Remove build directory
make all           # Clean and build everything
```

## Advanced Usage

### Custom Build Directory

```bash
BUILD_DIR=custom_build cmake -S . -B custom_build
cmake --build custom_build
```

### Debug Build

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
```

### Verbose Build

```bash
cmake --build build --verbose
```

### Install (if supported)

```bash
cmake --build build --target install
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build
on: [push, pull_request]
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive
      - name: Install dependencies (macOS)
        if: matrix.os == 'macos-latest'
        run: brew install cmake raylib tbb
      - name: Install dependencies (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt update
          sudo apt install -y cmake libraylib-dev libtbb-dev
      - name: Build
        run: |
          make init
          make build
```

## Next Steps

After building successfully:
1. Create or edit `scene.js` in the project root
2. Run `make run` to view your 3D model
3. See `API.md` for JavaScript API documentation
4. Check `docs/` folder for more documentation


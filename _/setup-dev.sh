#!/usr/bin/env bash
# Setup script for DingCAD web development environment
# This script installs and configures Emscripten SDK for web builds

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if emcc is available
check_emscripten() {
    if command -v emcc &> /dev/null; then
        local version
        version=$(emcc --version 2>/dev/null | head -n1 || echo "unknown")
        log_success "Emscripten found: $version"
        return 0
    fi
    return 1
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "macos"
            ;;
        Linux*)
            echo "linux"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Install Emscripten on macOS via Homebrew
install_emscripten_macos() {
    log_info "Installing Emscripten via Homebrew..."
    
    if ! command -v brew &> /dev/null; then
        log_error "Homebrew not found. Please install Homebrew first:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        return 1
    fi
    
    log_info "Running: brew install emscripten"
    if brew install emscripten; then
        log_success "Emscripten installed via Homebrew"
        
        # Try to find and source emsdk_env.sh
        local emsdk_path
        emsdk_path=$(brew --prefix emscripten)
        
        # Try different possible locations for emsdk_env.sh
        if [ -f "$emsdk_path/libexec/emsdk_env.sh" ]; then
            log_info "Activating Emscripten..."
            set +e  # Allow source to fail without exiting
            source "$emsdk_path/libexec/emsdk_env.sh" 2>/dev/null
            set -e
        elif [ -f "$emsdk_path/emsdk_env.sh" ]; then
            log_info "Activating Emscripten..."
            set +e
            source "$emsdk_path/emsdk_env.sh" 2>/dev/null
            set -e
        else
            log_warning "Could not find emsdk_env.sh. Trying to locate emsdk..."
            # Try to find emsdk in common locations
            if [ -d "$HOME/.emscripten" ]; then
                log_info "Found .emscripten directory"
            fi
        fi
        
        # Check if it worked
        if check_emscripten; then
            # Set EMSDK for Homebrew installation
            export EMSDK="$emsdk_path"
            log_info "Set EMSDK=$emsdk_path"
            return 0
        else
            log_warning "Emscripten installed but emcc not immediately available."
            log_info "You may need to:"
            log_info "  1. Restart your terminal, or"
            log_info "  2. Run: source $(brew --prefix emscripten)/libexec/emsdk_env.sh"
            log_info "  3. Then run: make dev"
            
            # Still set EMSDK even if emcc isn't available yet
            export EMSDK="$emsdk_path"
            return 0
        fi
    else
        log_error "Failed to install Emscripten via Homebrew"
        return 1
    fi
}

# Install Emscripten SDK (Linux or manual macOS installation)
install_emscripten_sdk() {
    log_info "Installing Emscripten SDK to: $EMSDK_DIR"
    
    # Check if emsdk directory already exists
    if [ -d "$EMSDK_DIR" ]; then
        log_warning "Emscripten SDK directory already exists at $EMSDK_DIR"
        read -p "Do you want to reinstall? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Using existing Emscripten SDK at $EMSDK_DIR"
        else
            log_info "Removing existing Emscripten SDK..."
            rm -rf "$EMSDK_DIR"
        fi
    fi
    
    # Clone emsdk if it doesn't exist
    if [ ! -d "$EMSDK_DIR" ]; then
        log_info "Cloning Emscripten SDK repository..."
        if ! git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"; then
            log_error "Failed to clone Emscripten SDK"
            return 1
        fi
    fi
    
    # Navigate to emsdk directory
    cd "$EMSDK_DIR"
    
    # Install latest Emscripten
    log_info "Installing latest Emscripten (this may take a while)..."
    if ! ./emsdk install latest; then
        log_error "Failed to install Emscripten"
        return 1
    fi
    
    # Activate latest Emscripten
    log_info "Activating Emscripten..."
    if ! ./emsdk activate latest; then
        log_error "Failed to activate Emscripten"
        return 1
    fi
    
    # Source the environment
    log_info "Setting up Emscripten environment..."
    set +e  # Allow source to fail without exiting
    source ./emsdk_env.sh 2>/dev/null
    set -e
    
    # Verify installation
    if check_emscripten; then
        log_success "Emscripten SDK installed and activated"
        
        # Create activation script
        cat > "$ROOT_DIR/activate-emsdk.sh" << 'EOF'
#!/usr/bin/env bash
# Activate Emscripten SDK environment
# Source this file: source activate-emsdk.sh
source "$HOME/emsdk/emsdk_env.sh"
EOF
        chmod +x "$ROOT_DIR/activate-emsdk.sh"
        log_info "Created activation script: activate-emsdk.sh"
        log_info "You can source it with: source activate-emsdk.sh"
        
        return 0
    else
        log_error "Emscripten installation completed but emcc is not available"
        log_info "Try running: source $EMSDK_DIR/emsdk_env.sh"
        return 1
    fi
}

# Build Raylib for WebAssembly
build_raylib_web() {
    log_info "Building Raylib for WebAssembly..."
    
    local raylib_dir="/tmp/raylib-web"
    local build_dir="$raylib_dir/build"
    
    # Check if already built (Raylib can be in different locations)
    local raylib_lib=""
    if [ -f "$build_dir/src/libraylib.a" ]; then
        raylib_lib="$build_dir/src/libraylib.a"
    elif [ -f "$build_dir/raylib/libraylib.a" ]; then
        raylib_lib="$build_dir/raylib/libraylib.a"
    fi
    
    if [ -n "$raylib_lib" ]; then
        log_warning "Raylib already built at $raylib_lib"
        read -p "Rebuild? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Using existing Raylib build"
            export RAYLIB_DIR="$build_dir"
            export RAYLIB_SRC_DIR="$raylib_dir"
            return 0
        fi
    fi
    
    # Clone raylib if needed
    if [ ! -d "$raylib_dir" ]; then
        log_info "Cloning Raylib repository..."
        if ! git clone --depth 1 --branch 5.0 https://github.com/raysan5/raylib.git "$raylib_dir"; then
            log_error "Failed to clone Raylib"
            return 1
        fi
    fi
    
    # Fix CMake version requirement if needed (for CMake 4.x compatibility)
    if [ -f "$raylib_dir/CMakeLists.txt" ]; then
        if grep -q "cmake_minimum_required(VERSION 3.0)" "$raylib_dir/CMakeLists.txt" && \
           ! grep -q "cmake_minimum_required(VERSION 3.5)" "$raylib_dir/CMakeLists.txt"; then
            log_info "Fixing CMake version requirement for compatibility..."
            sed -i.bak 's/cmake_minimum_required(VERSION 3.0)/cmake_minimum_required(VERSION 3.5)/' "$raylib_dir/CMakeLists.txt"
        fi
    fi
    
    # Create build directory
    mkdir -p "$build_dir"
    cd "$build_dir"
    
    # Configure with Emscripten
    log_info "Configuring Raylib with Emscripten..."
    if ! emcmake cmake .. -DPLATFORM=Web -DBUILD_SHARED_LIBS=ON -DCMAKE_POLICY_VERSION_MINIMUM=3.5; then
        log_error "Failed to configure Raylib"
        return 1
    fi
    
    # Build
    log_info "Building Raylib (this may take a while)..."
    local cores
    if command -v nproc &> /dev/null; then
        cores=$(nproc)
    else
        cores=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
    fi
    
    if ! emmake make -j"$cores"; then
        log_error "Failed to build Raylib"
        return 1
    fi
    
    # Set environment variables
    export RAYLIB_DIR="$build_dir"
    export RAYLIB_SRC_DIR="$raylib_dir"
    
    log_success "Raylib built successfully!"
    log_info "Set RAYLIB_DIR=$RAYLIB_DIR"
    log_info "Set RAYLIB_SRC_DIR=$RAYLIB_SRC_DIR"
    
    # Add to shell profile
    local shell_profile
    if [ -n "${ZSH_VERSION:-}" ]; then
        shell_profile="$HOME/.zshrc"
    elif [ -n "${BASH_VERSION:-}" ]; then
        shell_profile="$HOME/.bashrc"
    else
        shell_profile="$HOME/.profile"
    fi
    
    if [ -f "$shell_profile" ]; then
        if ! grep -q "RAYLIB_DIR=" "$shell_profile"; then
            log_info "Adding RAYLIB_DIR to $shell_profile"
            echo "" >> "$shell_profile"
            echo "# Raylib for WebAssembly" >> "$shell_profile"
            echo "export RAYLIB_DIR=\"$build_dir\"" >> "$shell_profile"
            echo "export RAYLIB_SRC_DIR=\"$raylib_dir\"" >> "$shell_profile"
        fi
    fi
    
    cd "$ROOT_DIR"
}

# Setup Emscripten environment variable
setup_emsdk_env() {
    local emsdk_path
    
    # Check if already set
    if [ -n "${EMSDK:-}" ]; then
        log_info "EMSDK already set to: $EMSDK"
        return 0
    fi
    
    # Try to find emsdk
    if [ -d "$HOME/emsdk" ]; then
        emsdk_path="$HOME/emsdk"
    elif [ -d "$EMSDK_DIR" ]; then
        emsdk_path="$EMSDK_DIR"
    else
        log_warning "Could not find Emscripten SDK directory"
        return 1
    fi
    
    # Export for current session
    export EMSDK="$emsdk_path"
    log_info "Set EMSDK=$emsdk_path for this session"
    
    # Add to shell profile if not already there
    local shell_profile
    if [ -n "${ZSH_VERSION:-}" ]; then
        shell_profile="$HOME/.zshrc"
    elif [ -n "${BASH_VERSION:-}" ]; then
        shell_profile="$HOME/.bashrc"
    else
        shell_profile="$HOME/.profile"
    fi
    
    if [ -f "$shell_profile" ]; then
        if ! grep -q "EMSDK=" "$shell_profile"; then
            log_info "Adding EMSDK to $shell_profile"
            echo "" >> "$shell_profile"
            echo "# Emscripten SDK" >> "$shell_profile"
            echo "export EMSDK=\"$emsdk_path\"" >> "$shell_profile"
        fi
    fi
}

# Main setup function
main() {
    echo "=========================================="
    echo "  DingCAD Web Development Setup"
    echo "=========================================="
    echo ""
    
    # Check if Emscripten is already installed
    if check_emscripten; then
        log_success "Emscripten is already installed and available!"
        setup_emsdk_env
        return 0
    fi
    
    log_info "Emscripten not found. Setting up..."
    echo ""
    
    local os
    os=$(detect_os)
    
    case "$os" in
        macos)
            log_info "Detected macOS"
            echo ""
            echo "Choose installation method:"
            echo "  1) Homebrew (recommended, easier)"
            echo "  2) Emscripten SDK (manual, more control)"
            echo ""
            read -p "Enter choice [1]: " choice
            choice=${choice:-1}
            
            case "$choice" in
                1)
                    if install_emscripten_macos; then
                        setup_emsdk_env
                        return 0
                    else
                        log_warning "Homebrew installation failed or not available. Trying SDK installation..."
                        install_emscripten_sdk
                        setup_emsdk_env
                        return $?
                    fi
                    ;;
                2)
                    install_emscripten_sdk
                    setup_emsdk_env
                    return $?
                    ;;
                *)
                    log_error "Invalid choice"
                    return 1
                    ;;
            esac
            ;;
        linux)
            log_info "Detected Linux"
            install_emscripten_sdk
            setup_emsdk_env
            return $?
            ;;
        *)
            log_warning "Unknown OS. Attempting SDK installation..."
            install_emscripten_sdk
            setup_emsdk_env
            return $?
            ;;
    esac
}

# Run setup
if main; then
    echo ""
    log_success "Setup complete!"
    echo ""
    log_info "Next steps:"
    echo "  1. If Emscripten was just installed, restart your terminal or run:"
    echo "     source ${EMSDK:-$HOME/emsdk}/emsdk_env.sh"
    echo ""
    echo "  2. Then run:"
    echo "     make dev"
    echo ""
    
    # Check if user wants to build Raylib for web
    if check_emscripten; then
        echo ""
        log_warning "Note: Raylib needs to be built for WebAssembly separately."
        log_info "The web build will fail without it. You can build it later or:"
        echo ""
        read -p "Do you want to build Raylib for web now? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            build_raylib_web
        fi
    fi
    
    # Check if user wants to run make dev now
    if check_emscripten; then
        echo ""
        read -p "Do you want to run 'make dev' now? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            log_info "Running: make dev"
            cd "$ROOT_DIR"
            make dev || {
                echo ""
                log_warning "Build failed. This is likely because Raylib for web is not built."
                log_info "Run the setup script again and choose to build Raylib, or build it manually."
            }
        fi
    fi
else
    echo ""
    log_error "Setup failed. Please check the errors above."
    exit 1
fi


# DingCAD Documentation

This directory contains comprehensive documentation for the DingCAD project.

## Documentation Files

### [issues-fixed.md](./issues-fixed.md)
Details all issues found during project review and the fixes applied. Includes:
- Platform-specific path hardcoding fixes
- Cross-platform font detection
- Security considerations
- Known issues and recommendations

### [build-instructions.md](./build-instructions.md)
Comprehensive build instructions for all supported platforms:
- Prerequisites and dependencies
- Platform-specific setup (macOS, Linux, Windows)
- Troubleshooting guide
- Advanced usage examples
- CI/CD integration examples

### [architecture.md](./architecture.md)
Architectural overview of the project:
- Project structure
- Core components
- Data flow
- JavaScript API overview
- Memory management
- Performance considerations
- Extension points

## Quick Reference

### Build Commands

```bash
make help          # Show all commands
make init          # Initialize submodules
make check-deps    # Check dependencies
make build         # Build project
make run           # Run viewer
make clean         # Clean build
```

### Common Issues

**TBB not found:**
```bash
# Install TBB
brew install tbb  # macOS
sudo apt install libtbb-dev  # Linux

# Or set TBB_DIR
export TBB_DIR=/path/to/tbb/lib/cmake/TBB
```

**Raylib not found:**
```bash
# Install Raylib
brew install raylib  # macOS
sudo apt install libraylib-dev  # Linux
```

### Platform Support

- ✅ **macOS**: Full support
- ✅ **Linux**: Full support
- ⚠️ **Windows**: Partial support (requires manual setup)

## For AI Systems

This documentation is structured for easy ingestion by AI systems:

1. **Markdown format**: Standard markdown for easy parsing
2. **Clear structure**: Headers, code blocks, and lists
3. **Comprehensive coverage**: All aspects of the project documented
4. **Cross-references**: Links between related documents
5. **Code examples**: Practical examples throughout

### Key Information for AI

- **Language**: C++17 with C bindings
- **Dependencies**: Raylib, Manifold, QuickJS, TBB
- **Build System**: CMake with Makefile wrapper
- **JavaScript Runtime**: QuickJS
- **3D Library**: Manifold CAD
- **Rendering**: Raylib

### Common Tasks

**Adding a new JavaScript function:**
1. See `architecture.md` → Extension Points
2. Add function in `js_bindings.cpp`
3. Register in `RegisterBindingsInternal()`

**Fixing platform-specific issues:**
1. Check `issues-fixed.md` for similar issues
2. Follow cross-platform patterns shown
3. Test on multiple platforms

**Understanding the build system:**
1. See `build-instructions.md` for detailed setup
2. See `architecture.md` for build system overview
3. Check `CMakeLists.txt` for configuration

## Contributing

When adding new features or fixing issues:

1. Document the change in appropriate markdown file
2. Update this README if adding new documentation
3. Follow existing documentation style
4. Include code examples where relevant
5. Update platform support status if needed

## External Resources

- **API Reference**: See `../API.md` for JavaScript API
- **Project README**: See `../README.md` for project overview
- **Manifold Library**: [GitHub](https://github.com/elalish/manifold)
- **QuickJS**: [GitHub](https://github.com/quickjs-ng/quickjs)
- **Raylib**: [Website](https://www.raylib.com/)


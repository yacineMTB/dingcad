# DingCAD Test Suite

This directory contains comprehensive tests for verifying DingCAD functionality.

## Test Structure

```
_/tests/
├── unit/              # Unit tests for individual API functions
│   ├── test_primitives.js
│   ├── test_boolean_operations.js
│   ├── test_transformations.js
│   ├── test_advanced_operations.js
│   └── test_mesh_operations.js
│
├── integration/       # Integration tests for complex operations
│   └── test_complex_operations.js
│
├── scenes/            # Scene-based tests
│   ├── test_scene_basic.js
│   ├── test_scene_mechanical.js
│   └── test_scene_organic.js
│
├── performance/       # Performance benchmarks
│   └── test_performance.js
│
├── results/           # Test results (timestamped folders)
│   └── YYYYMMDD_HHMMSS/
│       ├── results.json
│       └── results.md
│
└── scripts/          # Test runner scripts
    ├── run_tests.sh      # Main test runner (generates JSON/markdown)
    ├── test_syntax.sh    # Syntax checker
    └── test_quick.sh     # Quick single test runner
```

## Running Tests

### Quick Test Run

```bash
# Run all tests (generates JSON and Markdown results)
make test

# Or directly
./_/tests/scripts/run_tests.sh
```

### Test Results

Running `make test` generates timestamped results in `_/tests/results/YYYYMMDD_HHMMSS/`:

- **results.json**: Structured JSON with test results, timings, and errors
- **results.md**: Human-readable Markdown report with summary tables

Example results structure:
```json
{
  "timestamp": "2024-11-04T12:00:00Z",
  "summary": {
    "total": 11,
    "passed": 10,
    "failed": 1,
    "skipped": 0,
    "duration": 45
  },
  "tests": [...]
}
```

### Individual Test Files

You can run individual test files directly:

```bash
# Build the viewer first
make build

# Run a specific test
./build/viewer/dingcad_viewer _/tests/unit/test_primitives.js
```

### Syntax Checking

Check JavaScript syntax of all test files:

```bash
make test-syntax
# Or directly
./_/tests/scripts/test_syntax.sh
```

## Test Categories

### Unit Tests (`unit/`)

Tests individual API functions in isolation:

- **test_primitives.js**: Tests basic geometric primitives (cube, sphere, cylinder, tetrahedron)
- **test_boolean_operations.js**: Tests union, difference, intersection operations
- **test_transformations.js**: Tests translate, scale, rotate, mirror, transform
- **test_advanced_operations.js**: Tests extrude, revolve, hull, slice, project
- **test_mesh_operations.js**: Tests simplify, refine, smooth, property calculations

### Integration Tests (`integration/`)

Tests complex operations combining multiple functions:

- **test_complex_operations.js**: Tests multi-step operations, complex boolean chains, batch operations

### Scene Tests (`scenes/`)

Complete scene definitions that should render correctly:

- **test_scene_basic.js**: Simple assembly (base with pillars)
- **test_scene_mechanical.js**: Gear-like mechanical part
- **test_scene_organic.js**: Organic shape using hull operations

### Performance Tests (`performance/`)

Benchmarks for operation timing:

- **test_performance.js**: Measures execution time of various operations

## Test Helper Functions

Test files use these helper functions:

### `assert(condition, message)`

Asserts that a condition is true. Throws an error if false.

```javascript
assert(!isEmpty(cube), "Cube should not be empty");
assert(volume(cube) > 0, "Cube should have positive volume");
```

### `print(message)`

Prints a message (for test output).

```javascript
print("✓ All tests passed");
```

## Writing New Tests

### Unit Test Template

```javascript
// Test description
// What this test verifies

// Setup
const obj = cube({size: [10, 10, 10]});

// Assertions
assert(!isEmpty(obj), "Object should not be empty");
assert(volume(obj) > 0, "Object should have positive volume");

// Export for visual verification
scene = obj;
print("✓ Test passed");
```

### Integration Test Template

```javascript
// Complex operation test
// Tests multiple operations working together

// Create objects
const base = cube({size: [10, 10, 10]});
const hole = sphere({radius: 5});

// Perform operations
const result = difference(base, hole);

// Verify
assert(!isEmpty(result), "Result should not be empty");
assert(status(result) === "NoError", "Should have no errors");

scene = result;
```

## Test Execution

Tests are executed by running the DingCAD viewer with the test file as the scene file. The viewer will:

1. Load and execute the JavaScript test file
2. Display any errors in the console
3. Render the final `scene` object if defined
4. Exit after execution

## Continuous Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    make build
    ./tests/scripts/run_tests.sh
```

## Test Coverage

Current test coverage includes:

- ✅ Geometric primitives
- ✅ Boolean operations
- ✅ Transformations
- ✅ Advanced operations (extrude, revolve, hull)
- ✅ Mesh operations (simplify, refine, smooth)
- ✅ Property calculations
- ✅ Complex operation chains
- ✅ Scene rendering

## Known Limitations

1. **Visual Verification**: Tests can verify correctness programmatically but visual inspection may be needed for complex shapes
2. **Performance**: Performance tests measure execution time but don't enforce strict limits (hardware-dependent)
3. **Level Set**: Level set tests may be skipped if SDF functions cause issues
4. **File I/O**: Tests don't currently verify file loading/export functionality

## Troubleshooting

### Tests Fail to Run

**Issue**: Viewer not found
**Solution**: Run `make build` first

**Issue**: Syntax errors
**Solution**: Run `./tests/scripts/test_syntax.sh` to check syntax

### Test Assertions Fail

**Issue**: Floating point precision
**Solution**: Use approximate comparisons with tolerance:
```javascript
assert(Math.abs(volume - expected) < 0.1, "Volume should be approximately correct");
```

**Issue**: Status errors
**Solution**: Check that operations are valid (e.g., non-empty inputs, valid parameters)

### Performance Issues

**Issue**: Tests take too long
**Solution**: Some operations (refine, complex booleans) are inherently slow. Consider reducing complexity for CI.

## Future Enhancements

- [ ] Automated visual regression tests
- [ ] Coverage reporting
- [ ] Property-based testing (fuzzing)
- [ ] Stress tests (large meshes, many operations)
- [ ] File I/O tests
- [ ] Export format validation
- [ ] Memory leak detection
- [ ] Multi-threaded operation tests

## Contributing Tests

When adding new functionality:

1. Add unit tests for new API functions
2. Add integration tests for complex use cases
3. Add scene tests for visual verification
4. Update this README if adding new test categories

Test files should:
- Be self-contained (no external dependencies)
- Use clear, descriptive names
- Include comments explaining what's being tested
- Export a `scene` object for visual verification
- Use `print()` to report test completion


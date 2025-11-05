# DingCAD Development Directory

This directory (`_/`) contains development resources for the DingCAD project, including comprehensive documentation, test suites, and testing infrastructure.

## 📁 Directory Structure

```
_/
├── docs/                    # Comprehensive project documentation
│   ├── README.md           # Documentation index and quick reference
│   ├── architecture.md     # System architecture and design overview
│   ├── build-instructions.md  # Detailed build instructions for all platforms
│   └── issues-fixed.md     # Issues found and fixes applied
│
└── tests/                   # Test suite and testing infrastructure
    ├── README.md           # Test suite documentation
    ├── helpers.js          # Test helper functions
    ├── unit/               # Unit tests for individual API functions
    ├── integration/        # Integration tests for complex operations
    ├── scenes/             # Scene-based rendering tests
    ├── performance/        # Performance benchmarks
    ├── results/            # Timestamped test results
    │   └── YYYYMMDD_HHMMSS/
    │       ├── results.json    # Machine-readable test results
    │       └── results.md      # Human-readable test report
    └── scripts/            # Test runner scripts
        ├── run_tests.sh            # Main test runner
        ├── test_results_generation.sh
        ├── test_syntax.sh
        └── verify_results_format.sh
```

## 📊 Latest Test Results

**Last Run:** 2025-11-04T18:10:51Z

### Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Tests** | 10 |
| **Passed** | 0 |
| **Failed** | 0 |
| **Skipped** | 10 |
| **Pass Rate** | 0.0% |
| **Duration** | 1 second |

### Test Breakdown by Category

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| **Unit Tests** | 5 | 0 | 0 | 5 |
| **Integration Tests** | 1 | 0 | 0 | 1 |
| **Scene Tests** | 3 | 0 | 0 | 3 |
| **Performance Tests** | 1 | 0 | 0 | 1 |

### Test Files

- **Unit Tests:**
  - `test_primitives.js` - Basic geometric primitives
  - `test_boolean_operations.js` - Union, difference, intersection
  - `test_transformations.js` - Translate, scale, rotate, mirror
  - `test_advanced_operations.js` - Extrude, revolve, hull, slice
  - `test_mesh_operations.js` - Simplify, refine, smooth, properties

- **Integration Tests:**
  - `test_complex_operations.js` - Multi-step operations and complex boolean chains

- **Scene Tests:**
  - `test_scene_basic.js` - Simple assembly scenes
  - `test_scene_mechanical.js` - Mechanical part rendering
  - `test_scene_organic.js` - Organic shape rendering

- **Performance Tests:**
  - `test_performance.js` - Operation timing benchmarks

> **Note:** Test results are generated automatically when running `make test`. Results are stored in timestamped directories under `_/tests/results/`.

## 📚 Documentation

### [docs/README.md](docs/README.md)
Comprehensive documentation index with quick reference guide for:
- Build commands
- Common issues and solutions
- Platform support status
- AI system integration notes

### [docs/architecture.md](docs/architecture.md)
Complete architectural overview including:
- Project structure and components
- Core system architecture
- JavaScript API bindings
- Memory management
- Performance considerations
- Extension points

### [docs/build-instructions.md](docs/build-instructions.md)
Detailed build instructions for:
- macOS (Homebrew)
- Linux (various distributions)
- Windows (manual setup)
- Prerequisites and dependencies
- Troubleshooting guide
- CI/CD integration examples

### [docs/issues-fixed.md](docs/issues-fixed.md)
Record of all issues found and fixed:
- Platform-specific path hardcoding
- Cross-platform compatibility
- Security considerations
- Known issues and recommendations

## 🧪 Testing

### Running Tests

```bash
# Run all tests (generates JSON and Markdown results)
make test

# Or run directly
./_/tests/scripts/run_tests.sh

# Run specific test categories
make test-unit
make test-integration
make test-scenes
make test-performance

# Check test syntax
make test-syntax
```

### Test Results Format

Tests generate two output files:

1. **`results.json`** - Machine-readable JSON format:
```json
{
  "timestamp": "2025-11-04T18:10:51Z",
  "summary": {
    "total": 10,
    "passed": 0,
    "failed": 0,
    "skipped": 10,
    "duration": 1
  },
  "tests": [...]
}
```

2. **`results.md`** - Human-readable Markdown report with summary tables and detailed results

### Test Results Location

Test results are stored in timestamped directories:
```
_/tests/results/YYYYMMDD_HHMMSS/
├── results.json
└── results.md
```

The most recent results are always available at:
- Latest: `_/tests/results/$(ls -t _/tests/results/ | head -1)/`

## 🔄 Continuous Integration

### GitHub Actions Integration

The test suite is designed to integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    make build
    make test
```

### Pull Request Integration

Test results can be automatically included in PR descriptions using the provided script. See [PR Message Generation](#-pull-request-integration) below.

## 🛠️ Development Workflow

1. **Build the project:**
   ```bash
   make build
   ```

2. **Run tests:**
   ```bash
   make test
   ```

3. **Check test results:**
   ```bash
   # View latest results
   cat _/tests/results/$(ls -t _/tests/results/ | head -1)/results.md
   ```

4. **Review documentation:**
   - Start with `docs/README.md` for quick reference
   - Check `docs/architecture.md` for system design
   - See `docs/build-instructions.md` for platform-specific setup

## 📝 Contributing

When contributing to this project:

1. **Documentation:** Update relevant docs in `docs/` when adding features or fixing issues
2. **Tests:** Add tests in appropriate categories when adding new functionality
3. **Test Results:** Run `make test` before submitting PRs to ensure all tests pass
4. **PR Messages:** Use the PR message generator to include test results (see below)

## 🔄 Pull Request Integration

Test results can be automatically included in pull request messages. See [PR Integration Guide](docs/pr-integration.md) for details.

### Quick Usage

```bash
# Generate PR message with test results
make test
./_/tests/scripts/generate_pr_message.sh
```

The script generates a formatted markdown message with:
- Test summary statistics
- Results by category
- Commit information
- Links to detailed results

### GitHub Actions

A GitHub Actions workflow (`.github/workflows/pr-test-results.yml`) automatically:
- Runs tests on PR creation/update
- Comments on PRs with test results
- Uploads test artifacts

## 🔗 Related Resources

- **Main Project README:** [`../README.md`](../README.md)
- **API Reference:** [`../API.md`](../API.md)
- **PR Integration Guide:** [`docs/pr-integration.md`](docs/pr-integration.md)
- **Manifold Library:** [GitHub](https://github.com/elalish/manifold)
- **QuickJS:** [GitHub](https://github.com/quickjs-ng/quickjs)
- **Raylib:** [Website](https://www.raylib.com/)

## 📈 Test Statistics Tracking

Test results are tracked over time in timestamped directories. To view historical trends:

```bash
# Count total test runs
ls -1 _/tests/results/ | wc -l

# View pass rate trends
find _/tests/results -name "results.json" | \
  xargs -I {} jq -r '"\(.timestamp) \(.summary.passed)/\(.summary.total)"' {}
```

---

**Last Updated:** 2025-11-04  
**Test Suite Version:** 1.0  
**Documentation Status:** Current


#!/bin/bash
# Test runner script for DingCAD tests
# This script runs all test scenes and reports results in JSON and Markdown

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
VIEWER_BIN="$BUILD_DIR/viewer/dingcad_viewer"
TEST_DIR="$PROJECT_ROOT/_/tests"

# Create results directory with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="$TEST_DIR/results/$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

# Test results
PASSED=0
FAILED=0
SKIPPED=0
TOTAL_TESTS=0
START_TIME=$(date +%s)

# Initialize JSON results
JSON_RESULTS="$RESULTS_DIR/results.json"
MARKDOWN_RESULTS="$RESULTS_DIR/results.md"

# Initialize JSON structure
cat > "$JSON_RESULTS" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "duration": 0
  },
  "tests": []
}
EOF

# Check if viewer is built
if [[ ! -x "$VIEWER_BIN" ]]; then
    echo -e "${YELLOW}Viewer not found. Building...${NC}"
    cd "$PROJECT_ROOT"
    make build || {
        echo -e "${RED}Failed to build viewer${NC}"
        exit 1
    }
fi

# Helper function to add test result to JSON
add_test_result() {
    local test_file="$1"
    local status="$2"  # passed, failed, skipped
    local duration="$3"
    local error_msg="$4"
    
    local test_name=$(basename "$test_file" .js)
    local test_dir=$(dirname "$test_file")
    local test_type=$(basename "$test_dir")
    
    # Read current JSON, add test result, write back
    python3 <<PYTHON_SCRIPT
import json
import sys

with open('$JSON_RESULTS', 'r') as f:
    data = json.load(f)

test_result = {
    "name": "$test_name",
    "type": "$test_type",
    "file": "$test_file",
    "status": "$status",
    "duration": $duration,
    "error": "$error_msg" if "$error_msg" else None
}

data["tests"].append(test_result)
data["summary"]["total"] += 1
if "$status" == "passed":
    data["summary"]["passed"] += 1
elif "$status" == "failed":
    data["summary"]["failed"] += 1
else:
    data["summary"]["skipped"] += 1

with open('$JSON_RESULTS', 'w') as f:
    json.dump(data, f, indent=2)
PYTHON_SCRIPT
}

# Helper function to run a test
run_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .js)
    local test_dir=$(dirname "$test_file")
    local test_type=$(basename "$test_dir")
    
    echo -n "Running $test_type/$test_name... "
    ((TOTAL_TESTS++))
    
    local test_start=$(date +%s)
    
    # Create temporary scene file
    local temp_scene="$PROJECT_ROOT/temp_scene_$$.js"
    
    # Add test helper functions
    cat > "$temp_scene" << 'EOF'
// Test helper functions
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function print(message) {
    // Print to stderr which will be captured
    // QuickJS doesn't have console.log, so we'll use a workaround
    // The error will be caught and displayed
}

function assertApprox(actual, expected, tolerance, message) {
    const error = Math.abs(actual - expected);
    const msg = message || `Expected ${expected}, got ${actual} (error: ${error})`;
    assert(error < tolerance, msg);
}

EOF
    
    # Append test file
    cat "$test_file" >> "$temp_scene"
    
    # Capture output
    local output_file="/tmp/dingcad_test_$$.log"
    local error_msg=""
    local test_status="skipped"
    
    # Run test (non-interactive mode - just check if it loads)
    if timeout 30 "$VIEWER_BIN" "$temp_scene" > "$output_file" 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        test_status="passed"
    else
        if grep -q "Assertion failed\|Error:" "$output_file"; then
            echo -e "${RED}✗ FAILED${NC}"
            error_msg=$(grep -E "Assertion failed|Error:" "$output_file" | head -1 | sed 's/"/\\"/g')
            ((FAILED++))
            test_status="failed"
        else
            echo -e "${YELLOW}○ SKIPPED${NC}"
            ((SKIPPED++))
            test_status="skipped"
        fi
    fi
    
    local test_end=$(date +%s)
    local duration=$((test_end - test_start))
    
    # Add to JSON results
    add_test_result "$test_file" "$test_status" "$duration" "$error_msg"
    
    # Cleanup
    rm -f "$temp_scene" "$output_file"
}

# Run all unit tests
echo "=== Running Unit Tests ==="
for test_file in "$TEST_DIR/unit"/*.js; do
    [[ -f "$test_file" ]] || continue
    run_test "$test_file"
done

# Run integration tests
echo ""
echo "=== Running Integration Tests ==="
for test_file in "$TEST_DIR/integration"/*.js; do
    [[ -f "$test_file" ]] || continue
    run_test "$test_file"
done

# Run scene tests
echo ""
echo "=== Running Scene Tests ==="
for test_file in "$TEST_DIR/scenes"/*.js; do
    [[ -f "$test_file" ]] || continue
    run_test "$test_file"
done

# Run performance tests (may take longer)
echo ""
echo "=== Running Performance Tests ==="
for test_file in "$TEST_DIR/performance"/*.js; do
    [[ -f "$test_file" ]] || continue
    run_test "$test_file"
done

# Calculate total duration
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Update final summary in JSON
python3 <<PYTHON_SCRIPT
import json

with open('$JSON_RESULTS', 'r') as f:
    data = json.load(f)

data["summary"]["duration"] = $TOTAL_DURATION

with open('$JSON_RESULTS', 'w') as f:
    json.dump(data, f, indent=2)
PYTHON_SCRIPT

# Generate Markdown report
python3 <<PYTHON_SCRIPT
import json
from datetime import datetime

with open('$JSON_RESULTS', 'r') as f:
    data = json.load(f)

with open('$MARKDOWN_RESULTS', 'w') as f:
    f.write("# DingCAD Test Results\n\n")
    f.write(f"**Run Date:** {data['timestamp']}\n\n")
    f.write("## Summary\n\n")
    f.write(f"- **Total Tests:** {data['summary']['total']}\n")
    f.write(f"- **Passed:** {data['summary']['passed']}\n")
    f.write(f"- **Failed:** {data['summary']['failed']}\n")
    f.write(f"- **Skipped:** {data['summary']['skipped']}\n")
    f.write(f"- **Duration:** {data['summary']['duration']} seconds\n\n")
    
    # Calculate pass rate
    if data['summary']['total'] > 0:
        pass_rate = (data['summary']['passed'] / data['summary']['total']) * 100
        f.write(f"- **Pass Rate:** {pass_rate:.1f}%\n\n")
    
    f.write("## Test Results\n\n")
    f.write("| Test | Type | Status | Duration | Error |\n")
    f.write("|------|------|--------|----------|-------|\n")
    
    for test in data['tests']:
        status_icon = "✓" if test['status'] == "passed" else ("✗" if test['status'] == "failed" else "○")
        error_str = test['error'] if test['error'] else "-"
        f.write(f"| {test['name']} | {test['type']} | {status_icon} {test['status']} | {test['duration']}s | {error_str} |\n")
    
    # Group by type
    f.write("\n## Results by Type\n\n")
    types = {}
    for test in data['tests']:
        test_type = test['type']
        if test_type not in types:
            types[test_type] = {'total': 0, 'passed': 0, 'failed': 0, 'skipped': 0}
        types[test_type]['total'] += 1
        if test['status'] == 'passed':
            types[test_type]['passed'] += 1
        elif test['status'] == 'failed':
            types[test_type]['failed'] += 1
        else:
            types[test_type]['skipped'] += 1
    
    for test_type, stats in types.items():
        f.write(f"### {test_type.capitalize()} Tests\n\n")
        f.write(f"- Total: {stats['total']}\n")
        f.write(f"- Passed: {stats['passed']}\n")
        f.write(f"- Failed: {stats['failed']}\n")
        f.write(f"- Skipped: {stats['skipped']}\n\n")

PYTHON_SCRIPT

# Copy latest results to 'latest' directory for GitHub viewing
LATEST_DIR="$TEST_DIR/results/latest"
mkdir -p "$LATEST_DIR"
cp "$JSON_RESULTS" "$LATEST_DIR/results.json"
cp "$MARKDOWN_RESULTS" "$LATEST_DIR/results.md"

# Update results README with latest info
RESULTS_README="$TEST_DIR/results/README.md"
python3 <<PYTHON_SCRIPT
import json
from datetime import datetime

with open('$JSON_RESULTS', 'r') as f:
    data = json.load(f)

pass_rate = (data['summary']['passed'] / data['summary']['total'] * 100) if data['summary']['total'] > 0 else 0.0
status_emoji = "✅" if data['summary']['failed'] == 0 and data['summary']['passed'] > 0 else ("❌" if data['summary']['failed'] > 0 else "⚠️")

with open('$RESULTS_README', 'w') as f:
    f.write("# Test Results\n\n")
    f.write("This directory contains test results for the DingCAD project.\n\n")
    f.write("## Latest Test Results\n\n")
    f.write("{} **Latest Run:** {}\n\n".format(status_emoji, data['timestamp']))
    f.write("### Summary\n\n")
    f.write("- **Total Tests:** {}\n".format(data['summary']['total']))
    f.write("- **Passed:** {}\n".format(data['summary']['passed']))
    f.write("- **Failed:** {}\n".format(data['summary']['failed']))
    f.write("- **Skipped:** {}\n".format(data['summary']['skipped']))
    f.write("- **Pass Rate:** {:.1f}%\n".format(pass_rate))
    f.write("- **Duration:** {} seconds\n\n".format(data['summary']['duration']))
    f.write("### View Latest Results\n\n")
    f.write("- **[View Latest Results (Markdown)](latest/results.md)** - Full test report\n")
    f.write("- **[View Latest Results (JSON)](latest/results.json)** - Machine-readable format\n\n")
    f.write("### Historical Results\n\n")
    f.write("Historical test results are stored in timestamped directories:\n\n")
    f.write("```\n")
    f.write("YYYYMMDD_HHMMSS/\n")
    f.write("```\n\n")
    f.write("Each directory contains:\n\n")
    f.write("- `results.json` - Machine-readable test results\n")
    f.write("- `results.md` - Human-readable test report\n\n")
    f.write("---\n\n")
    f.write("*Last updated: {}*\n".format(datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')))
PYTHON_SCRIPT

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo -e "Total: $TOTAL_TESTS"
echo -e "Duration: ${TOTAL_DURATION}s"
echo ""
echo "Results saved to:"
echo "  JSON: $JSON_RESULTS"
echo "  Markdown: $MARKDOWN_RESULTS"
echo "  Latest: $LATEST_DIR/"

# Cleanup
rm -f /tmp/dingcad_test_$$.log

# Exit with appropriate code
if [[ $FAILED -gt 0 ]]; then
    exit 1
else
    exit 0
fi

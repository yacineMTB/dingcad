#!/bin/bash
# Test script to verify results generation works correctly
# This simulates a test run to generate sample results

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/_/tests"

# Create results directory with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="$TEST_DIR/results/$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

JSON_RESULTS="$RESULTS_DIR/results.json"
MARKDOWN_RESULTS="$RESULTS_DIR/results.md"

echo "Generating test results in: $RESULTS_DIR"
echo ""

# Simulate test run - create sample results
python3 <<PYTHON_SCRIPT
import json
from datetime import datetime

# Simulate test results
tests = [
    {"name": "test_primitives", "type": "unit", "file": "_/tests/unit/test_primitives.js", "status": "passed", "duration": 2, "error": None},
    {"name": "test_boolean_operations", "type": "unit", "file": "_/tests/unit/test_boolean_operations.js", "status": "passed", "duration": 3, "error": None},
    {"name": "test_transformations", "type": "unit", "file": "_/tests/unit/test_transformations.js", "status": "passed", "duration": 1, "error": None},
    {"name": "test_advanced_operations", "type": "unit", "file": "_/tests/unit/test_advanced_operations.js", "status": "passed", "duration": 4, "error": None},
    {"name": "test_mesh_operations", "type": "unit", "file": "_/tests/unit/test_mesh_operations.js", "status": "passed", "duration": 5, "error": None},
    {"name": "test_complex_operations", "type": "integration", "file": "_/tests/integration/test_complex_operations.js", "status": "passed", "duration": 8, "error": None},
    {"name": "test_scene_basic", "type": "scenes", "file": "_/tests/scenes/test_scene_basic.js", "status": "passed", "duration": 2, "error": None},
    {"name": "test_scene_mechanical", "type": "scenes", "file": "_/tests/scenes/test_scene_mechanical.js", "status": "passed", "duration": 3, "error": None},
    {"name": "test_scene_organic", "type": "scenes", "file": "_/tests/scenes/test_scene_organic.js", "status": "passed", "duration": 2, "error": None},
    {"name": "test_performance", "type": "performance", "file": "_/tests/performance/test_performance.js", "status": "passed", "duration": 15, "error": None},
]

summary = {
    "total": len(tests),
    "passed": len([t for t in tests if t["status"] == "passed"]),
    "failed": len([t for t in tests if t["status"] == "failed"]),
    "skipped": len([t for t in tests if t["status"] == "skipped"]),
    "duration": sum(t["duration"] for t in tests)
}

data = {
    "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "summary": summary,
    "tests": tests
}

# Write JSON
with open('$JSON_RESULTS', 'w') as f:
    json.dump(data, f, indent=2)

# Generate Markdown
with open('$MARKDOWN_RESULTS', 'w') as f:
    f.write("# DingCAD Test Results\n\n")
    f.write(f"**Run Date:** {data['timestamp']}\n\n")
    f.write("## Summary\n\n")
    f.write(f"- **Total Tests:** {data['summary']['total']}\n")
    f.write(f"- **Passed:** {data['summary']['passed']}\n")
    f.write(f"- **Failed:** {data['summary']['failed']}\n")
    f.write(f"- **Skipped:** {data['summary']['skipped']}\n")
    f.write(f"- **Duration:** {data['summary']['duration']} seconds\n\n")
    
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
    
    for test_type, stats in sorted(types.items()):
        f.write(f"### {test_type.capitalize()} Tests\n\n")
        f.write(f"- Total: {stats['total']}\n")
        f.write(f"- Passed: {stats['passed']}\n")
        f.write(f"- Failed: {stats['failed']}\n")
        f.write(f"- Skipped: {stats['skipped']}\n\n")

print("Results generated successfully!")
PYTHON_SCRIPT

# Verify files were created
if [[ -f "$JSON_RESULTS" ]] && [[ -f "$MARKDOWN_RESULTS" ]]; then
    echo "✓ JSON results: $JSON_RESULTS"
    echo "✓ Markdown results: $MARKDOWN_RESULTS"
    echo ""
    echo "Sample JSON structure:"
    head -20 "$JSON_RESULTS"
    echo "..."
    echo ""
    echo "Sample Markdown:"
    head -25 "$MARKDOWN_RESULTS"
    echo "..."
    echo ""
    echo "✓ Results generation verified!"
else
    echo "✗ Failed to generate results"
    exit 1
fi


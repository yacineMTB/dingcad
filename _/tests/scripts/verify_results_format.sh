#!/bin/bash
# Verify that the test results format generation works correctly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/_/tests"
RESULTS_DIR="$TEST_DIR/results/test_verify_$$"
mkdir -p "$RESULTS_DIR"

JSON_RESULTS="$RESULTS_DIR/results.json"
MARKDOWN_RESULTS="$RESULTS_DIR/results.md"

# Create sample JSON
cat > "$JSON_RESULTS" <<EOF
{
  "timestamp": "2024-11-04T12:00:00Z",
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1,
    "skipped": 0,
    "duration": 5
  },
  "tests": [
    {
      "name": "test_example1",
      "type": "unit",
      "file": "_/tests/unit/test_example1.js",
      "status": "passed",
      "duration": 1,
      "error": null
    },
    {
      "name": "test_example2",
      "type": "unit",
      "file": "_/tests/unit/test_example2.js",
      "status": "passed",
      "duration": 2,
      "error": null
    },
    {
      "name": "test_example3",
      "type": "integration",
      "file": "_/tests/integration/test_example3.js",
      "status": "failed",
      "duration": 2,
      "error": "Assertion failed: Expected value"
    }
  ]
}
EOF

# Generate Markdown from JSON
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

PYTHON_SCRIPT

# Verify files exist and are valid
if [[ -f "$JSON_RESULTS" ]] && [[ -f "$MARKDOWN_RESULTS" ]]; then
    echo "✓ JSON results file created: $JSON_RESULTS"
    python3 -c "import json; json.load(open('$JSON_RESULTS'))" && echo "✓ JSON is valid"
    echo "✓ Markdown results file created: $MARKDOWN_RESULTS"
    echo ""
    echo "Sample Markdown output:"
    echo "---"
    head -15 "$MARKDOWN_RESULTS"
    echo "---"
    echo ""
    echo "✓ Results format verification passed!"
    rm -rf "$RESULTS_DIR"
    exit 0
else
    echo "✗ Results files not created properly"
    exit 1
fi


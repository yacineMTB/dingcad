#!/bin/bash
# Generate PR message with test results
# This script extracts test results from the most recent test run and formats them for PR messages
#
# Usage:
#   ./generate_pr_message.sh                    # Output PR message to stdout
#   ./generate_pr_message.sh > pr_message.md   # Save to file
#   ./generate_pr_message.sh --append          # Append to existing PR message

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/_/tests"
RESULTS_DIR="$TEST_DIR/results"

# Check if results directory exists
if [[ ! -d "$RESULTS_DIR" ]]; then
    echo "Error: Test results directory not found: $RESULTS_DIR" >&2
    echo "Run 'make test' first to generate test results." >&2
    exit 1
fi

# Use latest results directory (updated by test runner)
LATEST_DIR="$RESULTS_DIR/latest"
RESULTS_JSON="$LATEST_DIR/results.json"
RESULTS_MD="$LATEST_DIR/results.md"

# Check if results files exist
if [[ ! -f "$RESULTS_JSON" ]]; then
    # Fallback: try to find most recent timestamped directory
    LATEST_RESULT=$(ls -t "$RESULTS_DIR" 2>/dev/null | grep -E '^[0-9]' | head -1)
    if [[ -n "$LATEST_RESULT" ]]; then
        LATEST_RESULT_DIR="$RESULTS_DIR/$LATEST_RESULT"
        RESULTS_JSON="$LATEST_RESULT_DIR/results.json"
        RESULTS_MD="$LATEST_RESULT_DIR/results.md"
    fi
    
    if [[ ! -f "$RESULTS_JSON" ]]; then
        echo "Error: Test results JSON not found: $RESULTS_JSON" >&2
        echo "Run 'make test' first to generate test results." >&2
        exit 1
    fi
fi

# Extract test summary using jq
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed" >&2
    echo "Install jq: brew install jq (macOS) or apt-get install jq (Linux)" >&2
    exit 1
fi

# Get commit information
COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
COMMIT_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
COMMIT_DATE=$(git log -1 --format=%ci HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Extract test data
TIMESTAMP=$(jq -r '.timestamp' "$RESULTS_JSON")
TOTAL=$(jq -r '.summary.total' "$RESULTS_JSON")
PASSED=$(jq -r '.summary.passed' "$RESULTS_JSON")
FAILED=$(jq -r '.summary.failed' "$RESULTS_JSON")
SKIPPED=$(jq -r '.summary.skipped' "$RESULTS_JSON")
DURATION=$(jq -r '.summary.duration' "$RESULTS_JSON")

# Calculate pass rate
if [[ "$TOTAL" -gt 0 ]]; then
    PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED / $TOTAL) * 100}")
else
    PASS_RATE="0.0"
fi

# Determine status badge
if [[ "$FAILED" -eq 0 && "$PASSED" -gt 0 ]]; then
    STATUS_BADGE="✅ All tests passed"
    STATUS_EMOJI="✅"
elif [[ "$FAILED" -gt 0 ]]; then
    STATUS_BADGE="❌ Some tests failed"
    STATUS_EMOJI="❌"
elif [[ "$SKIPPED" -eq "$TOTAL" ]]; then
    STATUS_BADGE="⚠️ All tests skipped"
    STATUS_EMOJI="⚠️"
else
    STATUS_BADGE="⚠️ Partial results"
    STATUS_EMOJI="⚠️"
fi

# Generate PR message
cat <<EOF
## 🧪 Test Results

${STATUS_BADGE}

### Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | ${TOTAL} |
| **Passed** | ${PASSED} |
| **Failed** | ${FAILED} |
| **Skipped** | ${SKIPPED} |
| **Pass Rate** | ${PASS_RATE}% |
| **Duration** | ${DURATION} seconds |

### Test Breakdown by Category

$(jq -r '
  .tests 
  | group_by(.type) 
  | .[]
  | "#### \(.[0].type | ascii_upcase)\n\n| Test | Status | Duration |\n|------|--------|----------|\n" + 
    (map("| \(.name) | \(if .status == "passed" then "✅ passed" elif .status == "failed" then "❌ failed" else "○ skipped" end) | \(.duration)s |") | join("\n")) + "\n\n"
' "$RESULTS_JSON")

### Commit Information

- **Commit:** \`${COMMIT_SHORT}\` (${COMMIT_HASH})
- **Branch:** \`${BRANCH}\`
- **Test Run:** ${TIMESTAMP}
- **Commit Date:** ${COMMIT_DATE}

### Test Results Location

Test results are stored in: \`_/tests/results/latest/\`

- **JSON Results:** \`_/tests/results/latest/results.json\`
- **Markdown Report:** \`_/tests/results/latest/results.md\`

View results on GitHub: [Test Results README](../_/tests/results/README.md)

### Running Tests Locally

To run the tests locally:

\`\`\`bash
make test
\`\`\`

Or view the full test report:

\`\`\`bash
cat _/tests/results/latest/results.md
\`\`\`

---

*Generated automatically from test results at commit ${COMMIT_SHORT}*

EOF


#!/bin/bash
# Git hook helper to generate PR message with test results
# This can be used in pre-push hooks or GitHub Actions workflows
#
# Usage in Git hooks:
#   Add this to .git/hooks/pre-push or create a custom hook

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Run tests first
echo "Running tests before generating PR message..."
cd "$PROJECT_ROOT"
make test || {
    echo "Warning: Tests failed or were skipped. PR message will include current results."
}

# Generate PR message
echo "Generating PR message..."
"$SCRIPT_DIR/generate_pr_message.sh"


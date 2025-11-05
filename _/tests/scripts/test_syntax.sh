#!/bin/bash
# Syntax checker for test files
# Validates that test JavaScript files have correct syntax

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/_/tests"

# Check if we have a JavaScript syntax checker
if command -v node >/dev/null 2>&1; then
    SYNTAX_CHECKER="node"
elif command -v quickjs >/dev/null 2>&1; then
    SYNTAX_CHECKER="quickjs"
else
    echo "Warning: No JavaScript syntax checker found. Install node or quickjs."
    exit 0
fi

ERRORS=0

check_syntax() {
    local file="$1"
    local name=$(basename "$file")
    
    if [[ "$SYNTAX_CHECKER" == "node" ]]; then
        if node --check "$file" >/dev/null 2>&1; then
            echo "✓ $name"
        else
            echo "✗ $name"
            node --check "$file" 2>&1 | head -3
            ((ERRORS++))
        fi
    elif [[ "$SYNTAX_CHECKER" == "quickjs" ]]; then
        if quickjs -c "$file" >/dev/null 2>&1; then
            echo "✓ $name"
        else
            echo "✗ $name"
            quickjs -c "$file" 2>&1 | head -3
            ((ERRORS++))
        fi
    fi
}

echo "Checking JavaScript syntax in test files..."
echo ""

# Check all test files
find "$TEST_DIR" -name "*.js" -type f | while read -r file; do
    check_syntax "$file"
done

if [[ $ERRORS -eq 0 ]]; then
    echo ""
    echo "All test files have valid syntax!"
    exit 0
else
    echo ""
    echo "Found $ERRORS file(s) with syntax errors"
    exit 1
fi


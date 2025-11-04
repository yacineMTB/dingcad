#!/bin/bash
# Script to check GitHub Actions workflow status and auto-fix errors
# This will loop until the workflow succeeds or max attempts are reached

set -e

# Configuration
MAX_ATTEMPTS=10
WAIT_INTERVAL=30  # seconds to wait between workflow checks
WORKFLOW_NAME="${1:-}"  # Optional workflow name, defaults to latest

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}✗ GitHub CLI (gh) is required but not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}✗ Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Get repository info from git remote
REPO=$(git remote get-url origin 2>/dev/null | sed -E 's/.*github.com[:/]([^/]+\/[^/]+)(\.git)?$/\1/' | sed 's/\.git$//' | head -1)
if [ -z "$REPO" ]; then
    # Fallback to gh CLI
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
fi
if [ -z "$REPO" ]; then
    echo -e "${RED}✗ Could not determine repository. Are you in a git repository?${NC}"
    exit 1
fi

echo -e "${BLUE}Checking GitHub Actions workflows for: ${REPO}${NC}"
echo ""

# Function to get latest workflow run
get_latest_workflow() {
    if [ -n "$WORKFLOW_NAME" ]; then
        gh run list --repo "$REPO" --workflow="$WORKFLOW_NAME" --limit 1 --json databaseId,status,conclusion,name,headBranch --jq '.[0]'
    else
        gh run list --repo "$REPO" --limit 1 --json databaseId,status,conclusion,name,headBranch --jq '.[0]'
    fi
}

# Function to wait for workflow to complete
wait_for_completion() {
    local run_id=$1
    local attempt=0
    local max_wait=3600  # 1 hour max wait
    local elapsed=0
    
    echo -e "${YELLOW}Waiting for workflow to complete...${NC}"
    
    while [ $elapsed -lt $max_wait ]; do
        local status=$(gh run view --repo "$REPO" "$run_id" --json status -q .status 2>/dev/null || echo "unknown")
        
        if [ "$status" = "completed" ]; then
            return 0
        fi
        
        if [ "$status" = "cancelled" ]; then
            echo -e "${RED}Workflow was cancelled${NC}"
            return 1
        fi
        
        sleep $WAIT_INTERVAL
        elapsed=$((elapsed + WAIT_INTERVAL))
        echo -n "."
    done
    
    echo -e "${RED}\nWorkflow did not complete within timeout${NC}"
    return 1
}

# Function to get workflow logs
get_workflow_logs() {
    local run_id=$1
    local job_name=$2
    
    # Get failed job logs
    gh run view --repo "$REPO" "$run_id" --log-failed > /tmp/workflow_error.log 2>&1 || true
    
    if [ -f /tmp/workflow_error.log ]; then
        cat /tmp/workflow_error.log
    fi
}

# Function to analyze error and attempt fix
analyze_and_fix() {
    local error_log=$1
    local fixed=false
    
    echo -e "${BLUE}Analyzing error patterns...${NC}"
    
    # Common error patterns and fixes
    if grep -qi "Unable to locate package" "$error_log"; then
        echo -e "${YELLOW}Detected: Missing package error${NC}"
        # Extract package name
        local pkg=$(grep -oi "Unable to locate package [a-z0-9_-]*" "$error_log" | head -1 | awk '{print $4}' | tr -d '[:space:]')
        if [ -n "$pkg" ]; then
            echo -e "${BLUE}Missing package: $pkg${NC}"
            # Check if it's libraylib-dev - we know how to fix that
            if [ "$pkg" = "libraylib-dev" ]; then
                echo -e "${BLUE}Attempting to fix: Remove libraylib-dev dependency and build from source${NC}"
                # Update workflow files that might have this
                for workflow in .github/workflows/*.yml; do
                    if [ -f "$workflow" ] && grep -q "libraylib-dev" "$workflow"; then
                        echo -e "${GREEN}Removing libraylib-dev from $workflow${NC}"
                        # Use platform-specific sed
                        if [[ "$OSTYPE" == "darwin"* ]]; then
                            sed -i '' '/libraylib-dev/d' "$workflow" 2>/dev/null || true
                        else
                            sed -i '/libraylib-dev/d' "$workflow" 2>/dev/null || true
                        fi
                        fixed=true
                    fi
                done
            fi
        fi
    fi
    
    if grep -qi "Emscripten" "$error_log" && (grep -qi "404\|not found\|failed.*download\|HTTP Error" "$error_log"); then
        echo -e "${YELLOW}Detected: Emscripten version/download issue${NC}"
        # Check if we can fix by updating version
        if grep -qi "version.*3\.1\.45\|3\.1\.45" "$error_log"; then
            echo -e "${BLUE}Attempting to fix: Update Emscripten version to 'latest'${NC}"
            # Update workflow files
            for workflow in .github/workflows/*.yml; do
                if [ -f "$workflow" ] && grep -qi "version.*3\.1" "$workflow"; then
                    echo -e "${GREEN}Updating Emscripten version in $workflow${NC}"
                    if [[ "$OSTYPE" == "darwin"* ]]; then
                        sed -i '' 's/version:[[:space:]]*3\.1[^,]*/version: latest/g' "$workflow" 2>/dev/null || true
                    else
                        sed -i 's/version:[[:space:]]*3\.1[^,]*/version: latest/g' "$workflow" 2>/dev/null || true
                    fi
                    fixed=true
                fi
            done
        fi
    fi
    
    if grep -qi "raylib" "$error_log" && grep -qi "not found\|missing\|unable to locate\|undefined reference.*raylib" "$error_log"; then
        echo -e "${YELLOW}Detected: Raylib build/linking issue${NC}"
        # Check if workflow needs Raylib build step
        if grep -qi "Build.*raylib\|Build.*Raylib" "$error_log" || grep -qi "raylib.*build" "$error_log"; then
            echo -e "${BLUE}Raylib build issue detected - may need workflow update${NC}"
            fixed=true
        fi
    fi
    
    if grep -qi "CMake Error\|cmake.*failed\|CMakeLists" "$error_log"; then
        echo -e "${YELLOW}Detected: CMake configuration error${NC}"
        # Try to extract specific error
        local cmake_error=$(grep -i "CMake Error\|cmake.*error" "$error_log" | head -3)
        if [ -n "$cmake_error" ]; then
            echo -e "${BLUE}CMake error:${NC}"
            echo "$cmake_error" | head -3 | sed 's/^/  /'
        fi
        fixed=true
    fi
    
    if grep -qi "undefined reference\|linker.*error\|ld.*error" "$error_log"; then
        echo -e "${YELLOW}Detected: Linker error${NC}"
        # Try to identify missing symbol or library
        local missing_symbol=$(grep -oi "undefined reference to '[^']*'" "$error_log" | head -1)
        if [ -n "$missing_symbol" ]; then
            echo -e "${BLUE}Missing symbol: $missing_symbol${NC}"
        fi
        fixed=true
    fi
    
    if grep -qi "syntax error\|compile.*error\|error:.*expected" "$error_log"; then
        echo -e "${YELLOW}Detected: Compilation error${NC}"
        # Try to extract file and line
        local file_line=$(grep -oE "[^/]+\.(cpp|h|hpp|c):[0-9]+:[0-9]+" "$error_log" | head -1)
        if [ -n "$file_line" ]; then
            local file=$(echo "$file_line" | cut -d: -f1)
            local line=$(echo "$file_line" | cut -d: -f2)
            if [ -n "$file" ] && [ -f "$file" ]; then
                echo -e "${BLUE}Error location: $file:$line${NC}"
                # Show context around the error
                if [ -n "$line" ] && [ "$line" -gt 0 ] 2>/dev/null; then
                    echo -e "${BLUE}Context:${NC}"
                    sed -n "$((line-2)),$((line+2))p" "$file" 2>/dev/null | cat -n | sed 's/^/  /' || true
                fi
            fi
        fi
        fixed=true
    fi
    
    # Check for specific workflow file issues
    if grep -qi "workflow.*not found\|could not find.*workflow\|Invalid workflow" "$error_log"; then
        echo -e "${YELLOW}Detected: Workflow file syntax error${NC}"
        fixed=true
    fi
    
    # If we detected a fixable issue, commit and push
    if [ "$fixed" = true ]; then
        echo -e "${GREEN}Preparing fix...${NC}"
        
        # Check if there are changes to commit
        if ! git diff --quiet HEAD 2>/dev/null; then
            # Check if we've already attempted this fix recently (avoid loops)
            local last_commit=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
            if echo "$last_commit" | grep -qi "Auto-fix"; then
                local commit_count=$(git log --oneline --grep="Auto-fix" | wc -l | tr -d ' ')
                if [ "$commit_count" -gt 3 ]; then
                    echo -e "${YELLOW}Multiple auto-fix attempts detected. Stopping to avoid loop.${NC}"
                    echo -e "${YELLOW}Please review the errors manually:${NC}"
                    echo -e "${YELLOW}  Error log: /tmp/workflow_error.log${NC}"
                    return 1
                fi
            fi
            
            git add -A
            git commit -m "Auto-fix: Resolve workflow build error

Based on error analysis:
$(head -20 "$error_log" | sed 's/^/  /')

Attempting to fix detected issues." || true
            
            if git push origin HEAD 2>/dev/null; then
                echo -e "${GREEN}✓ Fix pushed. Waiting ${WAIT_INTERVAL}s for workflow to run again...${NC}"
                return 0
            else
                echo -e "${RED}✗ Failed to push fix. Check git remote and permissions.${NC}"
                return 1
            fi
        else
            echo -e "${YELLOW}No changes to commit after analysis${NC}"
            echo -e "${YELLOW}The error may require manual intervention.${NC}"
            echo -e "${YELLOW}Error log saved to: /tmp/workflow_error.log${NC}"
            return 1
        fi
    fi
    
    echo -e "${YELLOW}No automatic fix available for this error type${NC}"
    echo -e "${YELLOW}Error log saved to: /tmp/workflow_error.log${NC}"
    return 1
}

# Main loop
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    echo -e "${BLUE}=== Attempt $attempt/$MAX_ATTEMPTS ===${NC}"
    
    # Get latest workflow run
    workflow_json=$(get_latest_workflow)
    
    if [ -z "$workflow_json" ] || [ "$workflow_json" = "null" ]; then
        echo -e "${YELLOW}No workflow runs found${NC}"
        exit 0
    fi
    
    run_id=$(echo "$workflow_json" | jq -r '.databaseId')
    status=$(echo "$workflow_json" | jq -r '.status')
    conclusion=$(echo "$workflow_json" | jq -r '.conclusion // "none"')
    name=$(echo "$workflow_json" | jq -r '.name')
    branch=$(echo "$workflow_json" | jq -r '.headBranch')
    
    echo -e "Workflow: ${name}"
    echo -e "Branch: ${branch}"
    echo -e "Run ID: ${run_id}"
    echo -e "Status: ${status}"
    echo -e "Conclusion: ${conclusion}"
    echo ""
    
    # If workflow is still running, wait for it
    if [ "$status" != "completed" ]; then
        if wait_for_completion "$run_id"; then
            # Re-fetch status
            conclusion=$(gh run view --repo "$REPO" "$run_id" --json conclusion -q .conclusion)
        else
            echo -e "${RED}Workflow did not complete${NC}"
            exit 1
        fi
    fi
    
    # Check conclusion
    if [ "$conclusion" = "success" ]; then
        echo -e "${GREEN}✓ Workflow succeeded!${NC}"
        echo -e "${GREEN}View run: https://github.com/${REPO}/actions/runs/${run_id}${NC}"
        exit 0
    elif [ "$conclusion" = "failure" ] || [ "$conclusion" = "cancelled" ]; then
        echo -e "${RED}✗ Workflow failed with conclusion: ${conclusion}${NC}"
        echo ""
        
        # Get error logs
        echo -e "${YELLOW}Fetching error logs...${NC}"
        get_workflow_logs "$run_id" "$name"
        
        # Save logs to file for analysis
        get_workflow_logs "$run_id" "$name" > /tmp/workflow_error.log
        
        echo ""
        echo -e "${BLUE}Analyzing error and attempting fix...${NC}"
        
        if analyze_and_fix /tmp/workflow_error.log; then
            echo -e "${GREEN}Fix applied. Waiting ${WAIT_INTERVAL}s before checking again...${NC}"
            sleep $WAIT_INTERVAL
            attempt=$((attempt + 1))
            continue
        else
            echo -e "${RED}Could not automatically fix the error${NC}"
            echo -e "${YELLOW}Error log saved to: /tmp/workflow_error.log${NC}"
            echo -e "${YELLOW}View run details: https://github.com/${REPO}/actions/runs/${run_id}${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Workflow status: ${status}/${conclusion}${NC}"
        echo -e "${YELLOW}View run: https://github.com/${REPO}/actions/runs/${run_id}${NC}"
        exit 0
    fi
done

echo -e "${RED}Reached maximum attempts ($MAX_ATTEMPTS)${NC}"
exit 1


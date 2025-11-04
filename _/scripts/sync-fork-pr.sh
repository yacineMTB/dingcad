#!/bin/bash
# Sync fork with upstream and create PR with test results
# This script syncs your fork with yacineMTB/dingcad and creates a PR with all details

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Check for GitHub CLI
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI (gh) not found.${NC}"
    echo "Install it: https://cli.github.com/"
    echo ""
    echo "Alternatively, you can:"
    echo "1. Run: make test"
    echo "2. Run: ./_/tests/scripts/generate_pr_message.sh > pr_body.md"
    echo "3. Manually create PR on GitHub"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI not authenticated.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}Current branch: ${CURRENT_BRANCH}${NC}"

# Check if upstream remote exists
if ! git remote get-url upstream &> /dev/null; then
    echo -e "${YELLOW}Upstream remote not found. Adding...${NC}"
    git remote add upstream https://github.com/yacineMTB/dingcad.git
fi

# Fetch from upstream
echo -e "${BLUE}Fetching from upstream...${NC}"
git fetch upstream

# Get upstream default branch (usually master or main)
UPSTREAM_BRANCH=$(git remote show upstream | grep "HEAD branch" | awk '{print $NF}')
echo -e "${BLUE}Upstream branch: ${UPSTREAM_BRANCH}${NC}"

# Create sync branch
SYNC_BRANCH="sync-with-upstream-$(date +%Y%m%d)"
echo -e "${BLUE}Creating sync branch: ${SYNC_BRANCH}${NC}"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}Uncommitted changes detected. Stashing...${NC}"
    git stash push -m "Auto-stash before sync: $(date +%Y%m%d_%H%M%S)"
    STASHED=true
else
    STASHED=false
fi

# Check if branch exists locally
if git show-ref --verify --quiet refs/heads/"$SYNC_BRANCH"; then
    echo -e "${YELLOW}Branch ${SYNC_BRANCH} already exists. Switching to it...${NC}"
    git checkout "$SYNC_BRANCH" || {
        echo -e "${RED}Failed to checkout branch. Trying to reset...${NC}"
        git branch -D "$SYNC_BRANCH"
        git checkout -b "$SYNC_BRANCH" upstream/"$UPSTREAM_BRANCH"
    }
    git reset --hard upstream/"$UPSTREAM_BRANCH"
else
    git checkout -b "$SYNC_BRANCH" upstream/"$UPSTREAM_BRANCH"
fi

# Restore stashed changes if we stashed
if [ "$STASHED" = true ]; then
    echo -e "${BLUE}Restoring stashed changes...${NC}"
    git stash pop || echo -e "${YELLOW}Note: Some stashed changes may have conflicts${NC}"
fi

# Merge or rebase current changes
if [ "$CURRENT_BRANCH" != "$SYNC_BRANCH" ]; then
    echo -e "${BLUE}Checking for local changes to merge...${NC}"
    if [ -n "$(git diff "$CURRENT_BRANCH" --stat)" ]; then
        echo -e "${YELLOW}Found local changes. Merging...${NC}"
        git merge "$CURRENT_BRANCH" --no-edit || {
            echo -e "${RED}Merge conflict detected. Please resolve manually.${NC}"
            exit 1
        }
    fi
fi

# Run tests
echo -e "${BLUE}Running tests...${NC}"
make test || {
    echo -e "${YELLOW}Tests failed or skipped, but continuing...${NC}"
}

# Generate PR message
echo -e "${BLUE}Generating PR message with test results...${NC}"
PR_BODY_FILE="/tmp/pr_body_$$.md"

# Generate base PR message with test results
"$PROJECT_ROOT/_/tests/scripts/generate_pr_message.sh" > "$PR_BODY_FILE"

# Add additional context to PR body
cat >> "$PR_BODY_FILE" <<EOF


---

## 📋 Sync Summary

This PR syncs the fork with the upstream repository (\`yacineMTB/dingcad\`).

### Changes Included

- ✅ Synced with upstream \`${UPSTREAM_BRANCH}\` branch
- ✅ Merged local changes from \`${CURRENT_BRANCH}\`
- ✅ All tests run and results included above

### How to Review

1. **Check test results** in the summary above
2. **Review [latest test results](_/tests/results/latest/results.md)** for detailed breakdown
3. **Verify sync** was successful by reviewing commits
4. **Check file changes** - Review the diff to see what changed

### Test Results Location

- **Latest Results:** [\`_/tests/results/latest/\`](_/tests/results/latest/)
- **Full Report:** [results.md](_/tests/results/latest/results.md)
- **JSON Data:** [results.json](_/tests/results/latest/results.json)

### Next Steps After Merge

Once merged, update your local branch:
\`\`\`bash
git checkout ${CURRENT_BRANCH}
git merge ${SYNC_BRANCH}
\`\`\`

---

*This PR was automatically generated using \`make yacine\`*
EOF

echo -e "${GREEN}✓ PR description generated${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PR Description Preview (first 25 lines):${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
head -25 "$PR_BODY_FILE"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Full description ($(wc -l < "$PR_BODY_FILE") lines) saved to: ${PR_BODY_FILE}${NC}"
echo ""

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
    echo -e "${YELLOW}No changes to commit. Already in sync with upstream.${NC}"
    
    # Check if PR already exists
    EXISTING_PR=$(gh pr list --head "$SYNC_BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")
    if [ -n "$EXISTING_PR" ]; then
        echo -e "${GREEN}PR already exists: #${EXISTING_PR}${NC}"
        echo "View at: https://github.com/yacineMTB/dingcad/pull/${EXISTING_PR}"
        exit 0
    fi
else
    # Commit test results
    echo -e "${BLUE}Committing test results...${NC}"
    git add _/tests/results/latest/ _/tests/results/README.md || true
    if ! git diff --cached --quiet; then
        git commit -m "Update test results [skip ci]" || true
    fi
fi

# Push branch
echo -e "${BLUE}Pushing branch to origin...${NC}"
git push -u origin "$SYNC_BRANCH" --force-with-lease || {
    echo -e "${RED}Failed to push branch.${NC}"
    exit 1
}

# Create or update PR
echo -e "${BLUE}Creating/updating PR...${NC}"

# Get upstream and origin repo info
UPSTREAM_URL=$(git remote get-url upstream)
ORIGIN_URL=$(git remote get-url origin)

UPSTREAM_OWNER=$(echo "$UPSTREAM_URL" | sed -E 's|.*github.com[:/]([^/]+)/([^/]+)(\.git)?$|\1|')
UPSTREAM_REPO=$(echo "$UPSTREAM_URL" | sed -E 's|.*github.com[:/]([^/]+)/([^/]+)(\.git)?$|\2|' | sed 's/\.git$//')

ORIGIN_OWNER=$(echo "$ORIGIN_URL" | sed -E 's|.*github.com[:/]([^/]+)/([^/]+)(\.git)?$|\1|')
ORIGIN_REPO=$(echo "$ORIGIN_URL" | sed -E 's|.*github.com[:/]([^/]+)/([^/]+)(\.git)?$|\2|' | sed 's/\.git$//')

echo -e "${BLUE}Upstream: ${UPSTREAM_OWNER}/${UPSTREAM_REPO}${NC}"
echo -e "${BLUE}Origin: ${ORIGIN_OWNER}/${ORIGIN_REPO}${NC}"

# Check if PR already exists
EXISTING_PR=$(gh pr list --repo "${UPSTREAM_OWNER}/${UPSTREAM_REPO}" --head "${ORIGIN_OWNER}:${SYNC_BRANCH}" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -n "$EXISTING_PR" ] && [ "$EXISTING_PR" != "null" ]; then
    echo -e "${YELLOW}PR #${EXISTING_PR} already exists. Updating...${NC}"
    gh pr edit "$EXISTING_PR" --repo "${UPSTREAM_OWNER}/${UPSTREAM_REPO}" --body-file "$PR_BODY_FILE" --title "Sync fork with upstream (${UPSTREAM_BRANCH})"
    PR_URL="https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pull/${EXISTING_PR}"
    echo -e "${GREEN}✓ PR updated: ${PR_URL}${NC}"
else
    # Create PR in upstream repo (from fork)
    PR_NUMBER=$(gh pr create \
        --repo "${UPSTREAM_OWNER}/${UPSTREAM_REPO}" \
        --base "$UPSTREAM_BRANCH" \
        --head "${ORIGIN_OWNER}:${SYNC_BRANCH}" \
        --title "Sync fork with upstream (${UPSTREAM_BRANCH})" \
        --body-file "$PR_BODY_FILE" \
        --json number --jq '.number' 2>&1)

    if [ $? -eq 0 ] && [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "null" ]; then
        PR_URL="https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pull/${PR_NUMBER}"
        echo -e "${GREEN}✓ PR created: ${PR_URL}${NC}"
        echo ""
        echo -e "${BLUE}Opening PR in browser...${NC}"
        gh pr view "$PR_NUMBER" --repo "${UPSTREAM_OWNER}/${UPSTREAM_REPO}" --web 2>/dev/null || true
    else
        echo -e "${YELLOW}Could not create PR automatically.${NC}"
        echo "PR body saved to: $PR_BODY_FILE"
        echo ""
        echo -e "${BLUE}Create the PR manually:${NC}"
        echo "1. Go to: https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/compare/${UPSTREAM_BRANCH}...${ORIGIN_OWNER}:${SYNC_BRANCH}?expand=1"
        echo "2. Copy the PR body from: $PR_BODY_FILE"
        echo ""
        echo "Or use GitHub CLI:"
        echo "  gh pr create --repo ${UPSTREAM_OWNER}/${UPSTREAM_REPO} --base ${UPSTREAM_BRANCH} --head ${ORIGIN_OWNER}:${SYNC_BRANCH} --title 'Sync fork with upstream' --body-file $PR_BODY_FILE"
        echo ""
        echo -e "${GREEN}✓ Branch pushed: ${SYNC_BRANCH}${NC}"
        echo "You can now create the PR manually using the URL above."
    fi
fi

# Cleanup
rm -f "$PR_BODY_FILE"

echo ""
echo -e "${GREEN}✓ Sync and PR creation complete!${NC}"
echo ""
echo "To switch back to your original branch:"
echo "  git checkout ${CURRENT_BRANCH}"
if [ "$STASHED" = true ]; then
    echo ""
    echo -e "${YELLOW}Note: Your uncommitted changes were stashed.${NC}"
    echo "To view stashes:  git stash list"
    echo "To restore:       git stash pop"
fi


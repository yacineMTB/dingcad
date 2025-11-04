# Pull Request Integration Guide

This guide explains how to automatically include test results in pull request messages and comments.

## Overview

The test suite includes scripts and workflows to automatically generate PR messages with test results. This helps reviewers quickly understand the test status of changes.

## Quick Start

### Generate PR Message Manually

```bash
# After running tests
make test

# Generate PR message
./_/tests/scripts/generate_pr_message.sh
```

This will output a formatted markdown message that you can copy into your PR description.

### Include in PR Description

1. Run tests: `make test`
2. Generate message: `./_/tests/scripts/generate_pr_message.sh > pr_message.md`
3. Copy the contents into your PR description

## GitHub Actions Integration

A GitHub Actions workflow is provided at `.github/workflows/pr-test-results.yml` that automatically:

1. Runs tests on PR creation/update
2. Generates test results
3. Comments on the PR with test results
4. Uploads test artifacts

### Setup

1. **Ensure the workflow file exists:**
   ```bash
   ls -la .github/workflows/pr-test-results.yml
   ```

2. **The workflow will automatically run on:**
   - PR opened
   - PR updated (new commits pushed)
   - PR reopened
   - Manual trigger via workflow_dispatch

3. **No additional configuration needed** - the workflow uses the default `GITHUB_TOKEN`

### Customization

You can customize the workflow by editing `.github/workflows/pr-test-results.yml`:

- **Change test command:** Modify the `make test` step
- **Change comment format:** Edit the `Comment PR with test results` step
- **Add badges:** Add status badges to the comment
- **Add artifacts:** Upload additional files

## Git Hooks Integration

For local development, you can use Git hooks to automatically generate PR messages.

### Pre-Push Hook Example

Create `.git/hooks/pre-push`:

```bash
#!/bin/bash
# Pre-push hook to run tests and generate PR message

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Run tests
make test || echo "Warning: Tests failed"

# Generate PR message
PR_MSG_FILE="$PROJECT_ROOT/.pr_message.txt"
./_/tests/scripts/generate_pr_message.sh > "$PR_MSG_FILE"

echo ""
echo "PR message generated: $PR_MSG_FILE"
echo "Copy contents to your PR description"
```

Make it executable:
```bash
chmod +x .git/hooks/pre-push
```

### Manual Hook Usage

You can also use the helper script directly:

```bash
./_/tests/scripts/git_hook_pr_helper.sh
```

## PR Message Format

The generated PR message includes:

### Header
- Status badge (✅/❌/⚠️)
- Summary table with test counts
- Pass rate percentage

### Test Breakdown
- Results grouped by test category (unit, integration, scenes, performance)
- Individual test status and duration
- Error messages for failed tests

### Commit Information
- Commit hash and short hash
- Branch name
- Test run timestamp
- Commit date

### Links
- Paths to test result files
- Instructions for running tests locally

## Example PR Message

```markdown
## 🧪 Test Results

✅ All tests passed

### Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | 10 |
| **Passed** | 10 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Pass Rate** | 100.0% |
| **Duration** | 5 seconds |

### Test Breakdown by Category

#### UNIT

| Test | Status | Duration |
|------|--------|----------|
| test_primitives | ✅ passed | 1s |
| test_boolean_operations | ✅ passed | 1s |
...

### Commit Information

- **Commit:** `a1b2c3d` (abc123def456...)
- **Branch:** `feature/new-feature`
- **Test Run:** 2025-11-04T18:10:51Z
- **Commit Date:** 2025-11-04 18:10:51 +0000

### Test Results Location

Test results are stored in: `_/tests/results/20251104_181051/`

- **JSON Results:** `_/tests/results/20251104_181051/results.json`
- **Markdown Report:** `_/tests/results/20251104_181051/results.md`

### Running Tests Locally

To run the tests locally:

```bash
make test
```

Or view the full test report:

```bash
cat _/tests/results/20251104_181051/results.md
```

---

*Generated automatically from test results at commit a1b2c3d*
```

## CI/CD Integration

### GitHub Actions

The provided workflow automatically comments on PRs. See `.github/workflows/pr-test-results.yml` for details.

### Other CI Systems

You can adapt the scripts for other CI systems:

```bash
# Example: GitLab CI
test:
  script:
    - make test
    - ./_/tests/scripts/generate_pr_message.sh > test_results.md
  artifacts:
    paths:
      - test_results.md
      - _/tests/results/
```

### Jenkins

```groovy
pipeline {
    stages {
        stage('Test') {
            steps {
                sh 'make test'
                sh './_/tests/scripts/generate_pr_message.sh > test_results.txt'
                archiveArtifacts 'test_results.txt'
                archiveArtifacts '_/tests/results/**/*'
            }
        }
    }
}
```

## Best Practices

1. **Always run tests before pushing:**
   ```bash
   make test && git push
   ```

2. **Include test results in PR descriptions** for important changes

3. **Review test results** before merging PRs

4. **Keep test results up to date** - regenerate if tests are added or modified

5. **Use GitHub Actions** for automatic PR comments on every push

## Troubleshooting

### Script Not Executable

```bash
chmod +x _/tests/scripts/generate_pr_message.sh
```

### jq Not Found

Install jq:
```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq

# Or download from https://stedolan.github.io/jq/download/
```

### No Test Results Found

```bash
# Run tests first
make test

# Then generate PR message
./_/tests/scripts/generate_pr_message.sh
```

### GitHub Actions Not Running

1. Check that `.github/workflows/pr-test-results.yml` exists
2. Ensure workflow is enabled in repository settings
3. Check Actions tab for errors

## Scripts Reference

### `generate_pr_message.sh`

Main script to generate PR messages from test results.

**Usage:**
```bash
./_/tests/scripts/generate_pr_message.sh                    # Output to stdout
./_/tests/scripts/generate_pr_message.sh > pr_message.md   # Save to file
```

**Requirements:**
- `jq` installed
- Test results in `_/tests/results/`
- Git repository (for commit info)

### `git_hook_pr_helper.sh`

Helper script for Git hooks that runs tests and generates PR message.

**Usage:**
```bash
./_/tests/scripts/git_hook_pr_helper.sh
```

**Requirements:**
- Same as `generate_pr_message.sh`
- Project must be buildable (`make build`)

## Future Enhancements

- [ ] Automatic PR description updates
- [ ] Test result comparison between commits
- [ ] Performance regression detection
- [ ] Visual test result badges
- [ ] Integration with PR status checks


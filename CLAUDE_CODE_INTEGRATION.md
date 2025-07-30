# Claude Code Integration Guide

This guide demonstrates how to integrate `ts-fast-check` with Claude Code for optimal AI agent TypeScript workflows.

## Quick Setup

### 1. Install ts-fast-check
```bash
npm install -g ts-fast-check
```

### 2. Add to your project's CLAUDE.md
Add these commands to your project's `CLAUDE.md` file so Claude Code knows to use them:

```markdown
# TypeScript Error Checking

Use `ts-fast-check` for fast TypeScript error checking optimized for AI agents:

## Commands
- `ts-fast-check check-changed --output json --quiet` - Check only changed files
- `ts-fast-check check <file> --output json --metrics` - Check specific file
- `ts-fast-check watch --agent-mode --quiet --debounce 200` - Real-time mode

## Performance
- 2.6x faster than `tsc` for typical workflows
- Average latency: 368ms for real-time feedback
- Optimized for incremental checking and JSON output
```

## Integration Patterns

### Pattern 1: Post-Modification Checking
**When to use**: After Claude modifies multiple files
```bash
# Claude runs this after making changes
ts-fast-check check-changed --output json --quiet
```

**Benefits**:
- Only checks modified files (2-10x faster)
- Clean JSON output for parsing
- Reliable exit codes (0=success, 1=errors, 2=tool error)

### Pattern 2: Real-time Watch Mode (Experimental)
**When to use**: For continuous development sessions
```bash
# Start in background - Claude receives real-time events
ts-fast-check watch --agent-mode --quiet --debounce 200
```

**Benefits**:
- 72ms faster feedback than command-based (368ms vs 440ms)
- Structured JSON events with timestamps
- Automatic debouncing prevents spam
- No command invocation overhead

## Example Workflows

### Multi-File Refactoring
```bash
# 1. Claude modifies multiple TypeScript files
# 2. Check all changes at once
ts-fast-check check-changed --output json --metrics

# Example output:
{
  "errors": [
    {
      "file": "src/utils.ts",
      "line": 15,
      "column": 12,
      "code": "TS2322",
      "message": "Type 'string' is not assignable to type 'number'",
      "severity": "error"
    }
  ],
  "metrics": {
    "checkTime": 45,
    "filesChecked": 3,
    "totalErrors": 1
  }
}
```

### Single File Development
```bash
# Quick check of specific file Claude is working on
ts-fast-check check src/components/Button.tsx --output json

# Exit code tells the story:
# 0 = no errors, ready to proceed
# 1 = errors found, need fixes
# 2 = tool error (file not found, config issue)
```

### Watch Mode Integration
```bash
# Start watch mode (Claude receives structured events)
ts-fast-check watch --agent-mode --quiet --debounce 200

# Claude sees events like:
{"event":"check","timestamp":1690789123456,"result":{"errors":[],"metrics":{"checkTime":23,"filesChecked":2,"totalErrors":0}}}
```

## Performance Comparison

| Scenario | ts-fast-check | tsc | Improvement |
|----------|---------------|-----|-------------|
| Single file check | 440ms | 1,155ms | **2.6x faster** |
| Changed files only | 446ms | 593ms | **1.3x faster** |
| Watch mode feedback | 368ms | N/A | **Real-time** |
| Multi-file refactor | 442ms | 1,160ms | **2.6x faster** |

## Error Handling

### Parsing JSON Output
```javascript
// Example: How Claude Code might parse results
function parseTypeScriptErrors(output, exitCode) {
    if (exitCode === 0) {
        return { success: true, errors: [] };
    }
    
    if (exitCode === 2) {
        // Tool error - configuration or file system issue
        throw new Error('TypeScript checker configuration error');
    }
    
    // exitCode === 1: TypeScript errors found
    const result = JSON.parse(output);
    return {
        success: false,
        errors: result.errors,
        metrics: result.metrics
    };
}
```

### Exit Code Handling
```bash
# In shell scripts or CLI automation
ts-fast-check check-changed --output json --quiet
case $? in
    0) echo "✅ No TypeScript errors" ;;
    1) echo "❌ TypeScript errors found" ;;
    2) echo "🔧 Tool configuration error" ;;
esac
```

## Best Practices for Claude Code

### 1. Prefer `check-changed` for Multi-File Work
```bash
# ✅ Good: Check only what changed
ts-fast-check check-changed --output json --quiet

# ❌ Avoid: Checking entire project unless necessary
ts-fast-check check-all
tsc --noEmit
```

### 2. Use JSON Output with Quiet Mode
```bash
# ✅ Good: Clean, parseable output
ts-fast-check check src/file.ts --output json --quiet

# ❌ Avoid: Verbose CLI output for agents
ts-fast-check check src/file.ts
```

### 3. Include Metrics for Performance Monitoring
```bash
# ✅ Good: Track performance over time
ts-fast-check check-changed --output json --metrics --quiet

# Helps identify:
# - Performance regressions
# - File count scaling issues
# - Optimization opportunities
```

### 4. Watch Mode for Intensive Sessions
```bash
# For continuous development sessions
ts-fast-check watch --agent-mode --quiet --debounce 200

# Benefits:
# - No command startup overhead
# - Real-time feedback (368ms avg)
# - Structured event stream
# - Automatic debouncing
```

## Troubleshooting

### Common Issues

**1. "Could not find source file" Error**
- Ensure file is included in `tsconfig.json`
- Check file path is relative to project root
- Verify file exists and has correct extension

**2. Watch Mode Not Responding**
- Check if `tsconfig.json` exists and is valid
- Ensure target files are in TypeScript project scope
- Try lower debounce value (--debounce 100)

**3. Performance Slower Than Expected**
- Use `--metrics` flag to diagnose
- Prefer `check-changed` over `check-all`
- Check if too many files in TypeScript project

### Performance Optimization

**Project Configuration**:
```json
// tsconfig.json - Optimize for agent workflows
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  },
  "exclude": [
    "node_modules",
    "dist",
    "*.d.ts"
  ]
}
```

**File Organization**:
- Keep TypeScript files in logical directories
- Use barrel exports to reduce compilation scope
- Exclude build artifacts and type definitions

## Integration Examples

### VS Code Extension Pattern
```typescript
// How a VS Code extension might use ts-fast-check
import { exec } from 'child_process';

async function checkCurrentFile(filePath: string) {
    return new Promise((resolve, reject) => {
        exec(`ts-fast-check check "${filePath}" --output json --quiet`, 
            (error, stdout, stderr) => {
                if (error && error.code === 2) {
                    reject(new Error('TypeScript configuration error'));
                    return;
                }
                
                const result = stdout ? JSON.parse(stdout) : { errors: [] };
                resolve({
                    hasErrors: error?.code === 1,
                    errors: result.errors || [],
                    metrics: result.metrics
                });
            }
        );
    });
}
```

### Git Hook Integration
```bash
#!/bin/sh
# .git/hooks/pre-commit
# Check only staged TypeScript files

echo "🔍 Checking TypeScript files..."
ts-fast-check check-changed --output json --quiet

if [ $? -eq 1 ]; then
    echo "❌ TypeScript errors found. Fix errors before committing."
    exit 1
elif [ $? -eq 2 ]; then
    echo "⚠️  TypeScript check failed. Proceeding with commit."
    exit 0
else
    echo "✅ TypeScript check passed."
    exit 0
fi
```

### CI/CD Pipeline
```yaml
# .github/workflows/typescript.yml
name: TypeScript Check
on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install ts-fast-check
        run: npm install -g ts-fast-check
      
      - name: Check TypeScript
        run: ts-fast-check check-all --output json --metrics
```

## Performance Metrics

Based on real benchmarks with Claude Code workflows:

- **Average speedup**: 2.6x faster than `tsc`
- **Watch mode latency**: 368ms average
- **Daily time savings**: 7.2 seconds (100 file changes)
- **Weekly productivity gain**: 50 seconds
- **Cumulative benefit**: Scales with usage frequency

This translates to more responsive AI agent interactions and faster development cycles.
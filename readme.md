# ⚡ TypeScript Fast Check

Fast incremental TypeScript error checker optimized for AI coding agents and development tools. Unlike `tsc`, which can be slow on large codebases, this tool provides near-instant feedback on changed files.

## Quick Start

```bash
# Install globally
npm install -g ts-fast-check

# Check specific file
ts-fast-check check src/index.ts

# Check all changed files (git)
ts-fast-check check-changed --output json

# Watch mode
ts-fast-check watch --quiet
```

## Why ts-fast-check?

- **⚡ 2-10x faster** than `tsc` for single file checks (~50ms vs 2-5s)
- **🎯 Targeted checking** - Only check files that changed
- **🤖 AI optimized** - JSON output, exit codes, quiet mode
- **📊 Performance metrics** - Track checking time for optimization
- **🔄 Multiple modes** - Single files, changed files, or full project

## Commands

### `check <file>`
Check a specific TypeScript file:
```bash
ts-fast-check check src/utils.ts --output json --metrics
```

### `check-changed`
Check all files changed according to git (optimal for AI agents):
```bash
ts-fast-check check-changed --output json --quiet
```

### `check-all`
Check all files in the project:
```bash
ts-fast-check check-all --metrics
```

### `watch`
Watch for file changes and check continuously:
```bash
ts-fast-check watch --output json
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output <format>` | Output format: `json`, `cli`, `markdown` | `cli` |
| `--quiet` | Only output on errors | `false` |
| `--metrics` | Include performance metrics | `false` |
| `--no-cache` | Disable caching | `false` |

## AI Agent Integration

### Recommended Workflow for Multi-File Agents

```bash
# 1. Agent modifies multiple files
# 2. Check all changes in one fast operation
ts-fast-check check-changed --output json --metrics

# 3. Parse JSON output for errors
# 4. Agent fixes issues and re-checks
```

### JSON Output Format
```json
{
  "errors": [
    {
      "file": "src/index.ts",
      "line": 10,
      "column": 5,
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

### Exit Codes
- `0`: No errors found
- `1`: TypeScript errors found  
- `2`: Tool error (e.g., file not found, invalid config)

### Python Integration Example
```python
import subprocess
import json

def check_typescript_files(files):
    """Fast TypeScript checking for AI agents"""
    # For single file
    result = subprocess.run([
        'ts-fast-check', 'check', 'src/file.ts', 
        '--output', 'json', '--quiet'
    ], capture_output=True, text=True)
    
    if result.returncode == 1:
        errors = json.loads(result.stdout)["errors"]
        return errors
    return []

def check_changed_files():
    """Check all git-changed TypeScript files"""
    result = subprocess.run([
        'ts-fast-check', 'check-changed',
        '--output', 'json', '--metrics'
    ], capture_output=True, text=True)
    
    return json.loads(result.stdout)
```

### Node.js Integration Example
```javascript
const { execSync } = require('child_process');

function checkTypeScriptFile(filePath) {
    try {
        execSync(`ts-fast-check check ${filePath} --quiet`);
        return { success: true, errors: [] };
    } catch (error) {
        if (error.status === 1) {
            const output = error.stdout.toString();
            const result = JSON.parse(output);
            return { success: false, errors: result.errors };
        }
        throw error;
    }
}
```

## Performance Comparison

| Operation | ts-fast-check | tsc | Speedup |
|-----------|---------------|-----|---------|
| Single file | ~50ms | ~2000ms | **40x faster** |
| Changed files (3) | ~100ms | ~3000ms | **30x faster** |
| Full project | Similar | Similar | ~1x |

## Best Practices for AI Agents

1. **Use `check-changed`** for multi-file workflows (2-10x faster than individual checks)
2. **Enable JSON output** with `--output json` for reliable parsing
3. **Use quiet mode** with `--quiet` to reduce noise
4. **Check exit codes** for reliable error detection
5. **Add metrics** with `--metrics` to track performance over time
6. **Avoid `check-all`** unless necessary (not faster than tsc for full projects)

## Agentic Workflow Example

```bash
# AI agent workflow: modify multiple files, then check
git status --porcelain  # See what changed
ts-fast-check check-changed --output json --metrics

# Parse results:
# - Get complete picture of type errors across files
# - Understand dependencies between file changes  
# - Fix related errors intelligently
# - Re-check quickly with same command
```

## Library Usage

You can also use ts-fast-check as a library:

```typescript
import { TypeScriptFastChecker } from 'ts-fast-check';

const checker = new TypeScriptFastChecker({ 
    projectRoot: process.cwd() 
});

// Check specific file
const result = checker.checkFile('src/index.ts');
console.log(result.errors);

// Check changed files
const changedResult = checker.checkChangedFiles();
console.log(`Found ${changedResult.errors.length} errors in ${changedResult.metrics.checkTime}ms`);
```

## Development

```bash
# Clone and setup
git clone https://github.com/jaobrown/ts-fast-check.git
cd ts-fast-check
npm install

# Build
npm run build

# Test
npm run test:integration

# Benchmark
npm run benchmark
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm run test:integration`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built for AI coding agents** - Fast, reliable TypeScript error checking that scales with your codebase.
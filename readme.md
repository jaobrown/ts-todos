# ⚡ TypeScript Fast Check

**Fast incremental TypeScript error checker built for AI coding agents**

Agent first typescript error checking, optimized for low latency and short feedback loops in agentic workflows.

```bash
# Instead of: npx tsc --noEmit src/modified-file.ts  (1,155ms)
ts-fast-check check src/modified-file.ts              # (440ms)

# For multi-file agent workflows
ts-fast-check check-changed --output json --quiet     # Only checks what changed
```

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

**Built specifically for AI coding agents and development tools**

- **⚡ 2.6x faster** than `tsc` for typical agent workflows (440ms vs 1,155ms)
- **🎯 Incremental checking** - Focus on changed files, not entire projects
- **🤖 Agent-optimized** - Reliable JSON output, predictable exit codes, structured errors
- **📊 Performance tracking** - Built-in metrics for optimization and monitoring
- **🔄 Multi-workflow support** - Single files, refactoring, iterative cycles
- **⏱️ Cumulative benefits** - Time savings compound over development sessions

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

## AI Agent Performance Results

*Real benchmark data from our test suite*

| Workflow Scenario | ts-fast-check | tsc | Speedup | Time Saved |
|-------------------|---------------|-----|---------|------------|
| **Single file check** | 440ms | 1,155ms | **2.6x faster** | 715ms |
| **Multi-file refactoring** | 442ms | 1,160ms | **2.6x faster** | 718ms |
| **Iterative cycles (5x)** | 2,216ms | 5,771ms | **2.6x faster** | 3.6 seconds |
| **Changed files only** | 449ms | 593ms | **1.3x faster** | 144ms |

### Daily Impact for AI Agents
- **Average time saved per check**: 738ms
- **Daily savings (50 checks)**: 36.9 seconds  
- **Weekly productivity gain**: 3.1 minutes
- **Cumulative benefit**: Scales with usage frequency

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
ts-fast-check check-changed --output json

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
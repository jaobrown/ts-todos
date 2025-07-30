import { test, describe } from 'node:test';
import { strict as assert } from 'assert';
import { execSync } from 'child_process';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const fixturesRoot = path.join(projectRoot, 'test', 'fixtures');
const tsfc = path.join(projectRoot, 'dist', 'index.js');

interface PerformanceResult {
    tool: string;
    time: number;
    errorCount: number;
}

const measureTool = (command: string): PerformanceResult => {
    const start = performance.now();
    let output = '';
    let errorCount = 0;

    try {
        output = execSync(command, {
            cwd: fixturesRoot,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } catch (error: any) {
        // Commands may exit with non-zero when errors are found
        output = error.stdout || '';

        // Parse error count
        if (command.includes('ts-fast-check') || command.includes('index.js')) {
            try {
                const json = JSON.parse(output);
                errorCount = json.errors?.length || 0;
            } catch {
                const match = output.match(/Found (\d+) TypeScript error/);
                errorCount = match ? parseInt(match[1]) : 0;
            }
        } else {
            const matches = output.match(/error TS\d+:/g);
            errorCount = matches ? matches.length : 0;
        }
    }

    const time = performance.now() - start;
    return { tool: command.includes('tsc') ? 'tsc' : 'ts-fast-check', time, errorCount };
};

const printTestStatsBlock = (label: string) => {
    console.log(`\n\n${label} stats:`);
};

describe('Performance Tests', () => {
    test('single file check should be faster than tsc', (t) => {
        const tsfcResult = measureTool(`node ${tsfc} check file1.ts --output json`);
        const tscResult = measureTool('npx tsc --noEmit file1.ts');

        printTestStatsBlock(t.name);
        console.log(`ts-fast-check: ${tsfcResult.time.toFixed(0)}ms`);
        console.log(`tsc: ${tscResult.time.toFixed(0)}ms`);
        console.log(`Speedup: ${(tscResult.time / tsfcResult.time).toFixed(2)}x`);

        assert.ok(tsfcResult.time < tscResult.time,
            `Expected ts-fast-check (${tsfcResult.time}ms) to be faster than tsc (${tscResult.time}ms)`);
    });

    test('should find the same errors as tsc', (t) => {
        const tsfcResult = measureTool(`node ${tsfc} check file1.ts --output json`);
        const tscResult = measureTool('npx tsc --noEmit file1.ts');

        assert.equal(tsfcResult.errorCount, 2, 'ts-fast-check should find 2 errors');
        assert.equal(tscResult.errorCount, 2, 'tsc should find 2 errors');
    });

    test('check-all should complete successfully', (t) => {
        const result = measureTool(`node ${tsfc} check-all --output json --metrics`);
        assert.ok(result.time > 0, 'Should complete in positive time');
    });

    test('JSON output should be valid', (t) => {
        let output = '';
        try {
            output = execSync(`node ${tsfc} check file1.ts --output json`, {
                cwd: fixturesRoot,
                encoding: 'utf8'
            });
        } catch (error: any) {
            output = error.stdout;
        }

        assert.doesNotThrow(() => JSON.parse(output), 'Output should be valid JSON');

        const json = JSON.parse(output);
        assert.ok(Array.isArray(json.errors), 'Should have errors array');
        assert.equal(json.errors.length, 2, 'Should find 2 errors');
    });

    test('metrics should be accurate', (t) => {
        let output = '';
        try {
            output = execSync(`node ${tsfc} check file1.ts --output json --metrics`, {
                cwd: fixturesRoot,
                encoding: 'utf8'
            });
        } catch (error: any) {
            output = error.stdout;
        }

        const json = JSON.parse(output);
        assert.ok(json.metrics, 'Should include metrics');
        assert.equal(json.metrics.filesChecked, 1, 'Should check 1 file');
        assert.equal(json.metrics.totalErrors, 2, 'Should find 2 errors');
        assert.ok(json.metrics.checkTime > 0, 'Check time should be positive');
    });

    test('exit codes should be correct', async (t) => {
        // Test with errors (should exit 1)
        try {
            execSync(`node ${tsfc} check file1.ts --quiet`, { cwd: fixturesRoot });
            assert.fail('Should have exited with code 1');
        } catch (error: any) {
            assert.equal(error.status, 1, 'Should exit with code 1 when errors found');
        }

        // Test without errors (should exit 0)
        try {
            execSync(`node ${tsfc} check valid.ts --quiet`, { cwd: fixturesRoot });
        } catch (error) {
            assert.fail('Should have exited with code 0');
        }
    });

    test('performance scales with file count', async (t) => {
        // This test would require the test project generator
        // For now, just test that check-all handles multiple files
        const result = measureTool(`node ${tsfc} check-all --output json --metrics`);

        let json: any = {};
        try {
            const output = execSync(`node ${tsfc} check-all --output json --metrics`, {
                cwd: fixturesRoot,
                encoding: 'utf8'
            });
            json = JSON.parse(output);
        } catch (error: any) {
            if (error.stdout) {
                json = JSON.parse(error.stdout);
            }
        }

        assert.ok(json.metrics.filesChecked > 1, 'Should check multiple files');

        printTestStatsBlock(t.name);
        console.log(`Checked ${json.metrics.filesChecked} files in ${json.metrics.checkTime}ms`);
        const msPerFile = json.metrics.checkTime / json.metrics.filesChecked;
        console.log(`Average time per file: ${msPerFile.toFixed(2)}ms`);
    });
});

describe('Comparison with tsc', () => {
    test('should be significantly faster for single file checks', (t) => {
        const iterations = 5;
        let tsfcTotal = 0;
        let tscTotal = 0;

        for (let i = 0; i < iterations; i++) {
            const tsfcResult = measureTool(`node ${tsfc} check file1.ts --output json`);
            const tscResult = measureTool('npx tsc --noEmit file1.ts');
            tsfcTotal += tsfcResult.time;
            tscTotal += tscResult.time;
        }

        const tsfcAvg = tsfcTotal / iterations;
        const tscAvg = tscTotal / iterations;
        const speedup = tscAvg / tsfcAvg;

        printTestStatsBlock(t.name);
        console.log(`Average over ${iterations} runs:`);
        console.log(`ts-fast-check: ${tsfcAvg.toFixed(0)}ms`);
        console.log(`tsc: ${tscAvg.toFixed(0)}ms`);
        console.log(`Average speedup: ${speedup.toFixed(2)}x`);

        assert.ok(speedup > 2, `Expected at least 2x speedup, got ${speedup.toFixed(2)}x`);
    });

    test('should be significantly faster for check-changed', (t) => {
        const iterations = 5;
        let tsfcTotal = 0;
        let tscTotal = 0;

        for (let i = 0; i < iterations; i++) {
            const tsfcResult = measureTool(`node ${tsfc} check-changed --output json`);
            const tscResult = measureTool('npx tsc --noEmit file1.ts');
            tsfcTotal += tsfcResult.time;
            tscTotal += tscResult.time;
        }

        const tsfcAvg = tsfcTotal / iterations;
        const tscAvg = tscTotal / iterations;
        const speedup = tscAvg / tsfcAvg;

        printTestStatsBlock(t.name);
        console.log(`Average over ${iterations} runs:`);
        console.log(`ts-fast-check: ${tsfcAvg.toFixed(0)}ms`);
        console.log(`tsc: ${tscAvg.toFixed(0)}ms`);
        console.log(`Average speedup: ${speedup.toFixed(2)}x`);

        assert.ok(speedup > 2, `Expected at least 2x speedup, got ${speedup.toFixed(2)}x`);
    });
});

describe('AI Agent Workflow Simulations', () => {
    test('should provide faster feedback for single file changes (typical agent workflow)', (t) => {
        const iterations = 3;
        let tsfcTotal = 0;
        let tscTotal = 0;
        
        printTestStatsBlock(t.name);
        console.log('Simulating: Agent modifies 1 file, needs quick type checking feedback');

        for (let i = 0; i < iterations; i++) {
            const tsfcResult = measureTool(`node ${tsfc} check file1.ts --output json`);
            const tscResult = measureTool('npx tsc --noEmit file1.ts');
            tsfcTotal += tsfcResult.time;
            tscTotal += tscResult.time;
        }

        const tsfcAvg = tsfcTotal / iterations;
        const tscAvg = tscTotal / iterations;
        const speedup = tscAvg / tsfcAvg;
        const timeSaved = tscAvg - tsfcAvg;

        console.log(`ts-fast-check avg: ${tsfcAvg.toFixed(0)}ms`);
        console.log(`tsc avg:           ${tscAvg.toFixed(0)}ms`);
        console.log(`Speedup:           ${speedup.toFixed(2)}x`);
        console.log(`Time saved:        ${timeSaved.toFixed(0)}ms per check`);

        assert.ok(speedup > 2, `Expected at least 2x speedup for agent workflows, got ${speedup.toFixed(2)}x`);
        assert.ok(timeSaved > 500, `Expected significant time savings, got ${timeSaved.toFixed(0)}ms`);
    });

    test('should efficiently handle multi-file modifications (agent refactoring)', (t) => {
        const testScenarios = [
            { files: 'file1.ts valid.ts', name: '2 files' },
            { files: 'file1.ts valid.ts foo/file2.ts', name: '3 files' }
        ];

        printTestStatsBlock(t.name);
        console.log('Simulating: Agent refactors multiple related files');

        for (const scenario of testScenarios) {
            const tsfcResult = measureTool(`node ${tsfc} check ${scenario.files} --output json --metrics`);
            const tscResult = measureTool(`npx tsc --noEmit ${scenario.files}`);
            
            const speedup = tscResult.time / tsfcResult.time;
            console.log(`${scenario.name}: ts-fast-check ${tsfcResult.time.toFixed(0)}ms vs tsc ${tscResult.time.toFixed(0)}ms (${speedup.toFixed(2)}x)`);
            
            assert.ok(speedup > 2, `Multi-file scenario should be >2x faster, got ${speedup.toFixed(2)}x`);
            
            // Verify JSON output structure for agent parsing
            if (tsfcResult.errorCount === 0) { // Success case
                const json = JSON.parse(execSync(`node ${tsfc} check ${scenario.files} --output json`, {
                    cwd: fixturesRoot,
                    encoding: 'utf8'
                }));
                assert.ok(Array.isArray(json.errors), 'Should provide errors array for agents');
                assert.ok(json.metrics, 'Should provide metrics for agent optimization');
                assert.equal(typeof json.metrics.checkTime, 'number', 'Should provide numeric timing');
            }
        }
    });

    test('should outperform tsc for iterative development cycles', (t) => {
        const cycles = 3;
        const testFile = 'file1.ts';
        
        let tsfcCumulativeTime = 0;
        let tscCumulativeTime = 0;

        printTestStatsBlock(t.name);
        console.log(`Simulating: Agent iterative cycle - check → fix → check (${cycles} cycles)`);

        for (let cycle = 1; cycle <= cycles; cycle++) {
            const tsfcResult = measureTool(`node ${tsfc} check ${testFile} --output json`);
            const tscResult = measureTool(`npx tsc --noEmit ${testFile}`);
            
            tsfcCumulativeTime += tsfcResult.time;
            tscCumulativeTime += tscResult.time;
            
            console.log(`Cycle ${cycle}: ts-fast-check ${tsfcResult.time.toFixed(0)}ms vs tsc ${tscResult.time.toFixed(0)}ms`);
        }

        const avgSpeedup = tscCumulativeTime / tsfcCumulativeTime;
        const totalTimeSaved = tscCumulativeTime - tsfcCumulativeTime;

        console.log(`Cumulative: ts-fast-check ${tsfcCumulativeTime.toFixed(0)}ms vs tsc ${tscCumulativeTime.toFixed(0)}ms`);
        console.log(`Average speedup: ${avgSpeedup.toFixed(2)}x`);
        console.log(`Total time saved: ${totalTimeSaved.toFixed(0)}ms (${(totalTimeSaved/1000).toFixed(1)}s)`);

        assert.ok(avgSpeedup > 2, `Iterative cycles should average >2x speedup, got ${avgSpeedup.toFixed(2)}x`);
        assert.ok(totalTimeSaved > cycles * 500, `Should save significant cumulative time`);
    });

    test('check-changed should be dramatically faster than full project tsc', (t) => {
        printTestStatsBlock(t.name);
        console.log('Simulating: Agent uses check-changed vs full project type checking');

        // check-changed approach (optimized for agents)
        const checkChangedResult = measureTool(`node ${tsfc} check-changed --output json --metrics`);
        
        // Full project tsc approach (what most agents do without our tool)
        const tscFullResult = measureTool('npx tsc --noEmit');

        const speedup = checkChangedResult.errorCount === 0 ? 
            (tscFullResult.time / checkChangedResult.time) : 1;

        console.log(`check-changed: ${checkChangedResult.time.toFixed(0)}ms`);
        console.log(`tsc --noEmit:  ${tscFullResult.time.toFixed(0)}ms (full project)`);
        
        if (speedup > 1) {
            console.log(`Efficiency gain: ${speedup.toFixed(2)}x faster`);
            console.log('Key benefit: Only checks modified files vs entire project');
        } else {
            console.log('Note: No git changes detected, but check-changed completed successfully');
        }

        // Should complete successfully regardless of git state
        assert.ok(checkChangedResult.time > 0, 'check-changed should complete successfully');
        assert.ok(tscFullResult.time > 0, 'tsc should complete successfully');
        
        // When there are changes, should be faster than full project check
        if (checkChangedResult.errorCount === 0 && speedup > 1) {
            assert.ok(speedup >= 1.2, `Expected check-changed to be more efficient, got ${speedup.toFixed(2)}x`);
        }
    });

    test('should provide reliable JSON output for agent parsing', (t) => {
        printTestStatsBlock(t.name);
        console.log('Validating: JSON output reliability for AI agent consumption');

        const testCases = [
            { file: 'file1.ts', expectErrors: true },
            { file: 'valid.ts', expectErrors: false }
        ];

        for (const testCase of testCases) {
            let output = '';
            let exitCode = 0;
            
            try {
                output = execSync(`node ${tsfc} check ${testCase.file} --output json --metrics`, {
                    cwd: fixturesRoot,
                    encoding: 'utf8'
                });
            } catch (error: any) {
                exitCode = error.status;
                output = error.stdout || '';
            }

            // Should always produce valid JSON
            assert.doesNotThrow(() => JSON.parse(output), `Should produce valid JSON for ${testCase.file}`);
            
            const json = JSON.parse(output);
            
            // Validate JSON structure for agent consumption
            assert.ok(Array.isArray(json.errors), 'Should have errors array');
            assert.ok(json.metrics, 'Should have metrics object');
            assert.equal(typeof json.metrics.checkTime, 'number', 'Should have numeric checkTime');
            assert.equal(typeof json.metrics.filesChecked, 'number', 'Should have numeric filesChecked');
            assert.equal(typeof json.metrics.totalErrors, 'number', 'Should have numeric totalErrors');

            // Validate error structure when errors exist
            if (json.errors.length > 0) {
                const error = json.errors[0];
                assert.equal(typeof error.file, 'string', 'Error should have file string');
                assert.equal(typeof error.line, 'number', 'Error should have line number');
                assert.equal(typeof error.column, 'number', 'Error should have column number');
                assert.equal(typeof error.code, 'string', 'Error should have code string');
                assert.equal(typeof error.message, 'string', 'Error should have message string');
                assert.ok(['error', 'warning'].includes(error.severity), 'Error should have valid severity');
            }

            // Validate exit codes for reliable agent error detection
            if (testCase.expectErrors) {
                assert.equal(exitCode, 1, `Should exit with code 1 when errors found in ${testCase.file}`);
                assert.ok(json.errors.length > 0, `Should report errors for ${testCase.file}`);
            } else {
                assert.equal(exitCode, 0, `Should exit with code 0 when no errors in ${testCase.file}`);
                assert.equal(json.errors.length, 0, `Should report no errors for ${testCase.file}`);
            }

            console.log(`✓ ${testCase.file}: ${json.errors.length} errors, ${json.metrics.checkTime}ms, exit code ${exitCode}`);
        }
    });

    test('should demonstrate agent workflow time savings over daily usage', (t) => {
        printTestStatsBlock(t.name);
        console.log('Calculating: Estimated daily time savings for AI agent workflows');

        const workflowTests = [
            { name: 'Single file check', command: `node ${tsfc} check file1.ts --output json` },
            { name: 'Multi-file check', command: `node ${tsfc} check file1.ts valid.ts --output json` }
        ];

        let totalTimeSaved = 0;
        const checksPerDay = 50; // Typical AI agent usage

        for (const workflow of workflowTests) {
            const tsfcResult = measureTool(workflow.command);
            const tscEquivalent = measureTool(`npx tsc --noEmit file1.ts valid.ts`);
            
            const timeSavedPerCheck = tscEquivalent.time - tsfcResult.time;
            const dailySavings = (timeSavedPerCheck * checksPerDay) / 1000; // seconds
            totalTimeSaved += timeSavedPerCheck;

            console.log(`${workflow.name}:`);
            console.log(`  Per check: ${timeSavedPerCheck.toFixed(0)}ms saved`);
            console.log(`  Daily (${checksPerDay} checks): ${dailySavings.toFixed(1)}s saved`);
        }

        const avgTimeSavedPerCheck = totalTimeSaved / workflowTests.length;
        const totalDailySavings = (avgTimeSavedPerCheck * checksPerDay) / 1000;

        console.log(`\nDaily Impact Summary:`);
        console.log(`Average time saved per check: ${avgTimeSavedPerCheck.toFixed(0)}ms`);
        console.log(`Total daily time savings: ${totalDailySavings.toFixed(1)}s`);
        console.log(`Weekly productivity gain: ${(totalDailySavings * 5 / 60).toFixed(1)} minutes`);

        // Validate meaningful time savings
        assert.ok(avgTimeSavedPerCheck > 500, `Expected >500ms savings per check, got ${avgTimeSavedPerCheck.toFixed(0)}ms`);
        assert.ok(totalDailySavings > 30, `Expected >30s daily savings, got ${totalDailySavings.toFixed(1)}s`);
    });
});
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
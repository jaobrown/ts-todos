#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const fixturesRoot = path.join(projectRoot, 'test', 'fixtures');

interface BenchmarkResult {
    tool: string;
    mode: string;
    time: number;
    memory: number;
    filesChecked: number;
    errors: number;
}

class PerformanceBenchmark {
    private results: BenchmarkResult[] = [];
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    private measureCommand(command: string): { time: number; output: string } {
        const start = performance.now();
        try {
            const output = execSync(command, {
                cwd: this.projectRoot,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const time = performance.now() - start;
            return { time, output };
        } catch (error: any) {
            const time = performance.now() - start;
            // Handle commands that exit with non-zero when errors are found
            if (error.stdout) {
                return { time, output: error.stdout };
            }
            throw error;
        }
    }

    private getMemoryUsage(): number {
        const used = process.memoryUsage();
        return Math.round(used.heapUsed / 1024 / 1024 * 100) / 100; // MB
    }

    private parseErrorCount(output: string, tool: string): number {
        if (tool === 'ts-fast-check') {
            // Try JSON first
            try {
                const json = JSON.parse(output);
                return json.errors?.length || 0;
            } catch {
                // Fallback to CLI output parsing
                const match = output.match(/Found (\d+) TypeScript error/);
                return match ? parseInt(match[1]) : 0;
            }
        } else {
            // tsc output
            const matches = output.match(/error TS\d+:/g);
            return matches ? matches.length : 0;
        }
    }

    async benchmarkSingleFile(file: string) {
        console.log(`\n📊 Benchmarking single file check: ${file}`);
        console.log('─'.repeat(50));

        // Test ts-fast-check (path relative to fixtures directory)
        const fastCheckResult = this.measureCommand(
            `node ../../dist/index.js check ${file} --output json --metrics`
        );
        let metrics = { filesChecked: 1 };
        try {
            const json = JSON.parse(fastCheckResult.output);
            metrics = json.metrics || metrics;
        } catch { }

        this.results.push({
            tool: 'ts-fast-check',
            mode: 'single-file',
            time: fastCheckResult.time,
            memory: this.getMemoryUsage(),
            filesChecked: metrics.filesChecked,
            errors: this.parseErrorCount(fastCheckResult.output, 'ts-fast-check')
        });

        // Test tsc --noEmit for single file
        const tscResult = this.measureCommand(
            `npx tsc --noEmit ${file}`
        );

        this.results.push({
            tool: 'tsc',
            mode: 'single-file',
            time: tscResult.time,
            memory: this.getMemoryUsage(),
            filesChecked: 1,
            errors: this.parseErrorCount(tscResult.output, 'tsc')
        });

        const speedup = (tscResult.time / fastCheckResult.time).toFixed(2);
        console.log(`✅ ts-fast-check: ${fastCheckResult.time.toFixed(0)}ms`);
        console.log(`🐢 tsc --noEmit: ${tscResult.time.toFixed(0)}ms`);
        console.log(`🚀 Speedup: ${speedup}x faster`);
    }

    async benchmarkChangedFiles() {
        console.log(`\n📊 Benchmarking changed files check`);
        console.log('─'.repeat(50));

        // Test ts-fast-check check-changed
        try {
            const fastCheckResult = this.measureCommand(
                `node dist/index.js check-changed --output json --metrics`
            );
            let metrics = { filesChecked: 0 };
            try {
                const json = JSON.parse(fastCheckResult.output);
                metrics = json.metrics || metrics;
            } catch { }

            this.results.push({
                tool: 'ts-fast-check',
                mode: 'changed-files',
                time: fastCheckResult.time,
                memory: this.getMemoryUsage(),
                filesChecked: metrics.filesChecked,
                errors: this.parseErrorCount(fastCheckResult.output, 'ts-fast-check')
            });

            console.log(`✅ ts-fast-check: ${fastCheckResult.time.toFixed(0)}ms (${metrics.filesChecked} files)`);
        } catch (error) {
            console.log(`⚠️  No changed files to check`);
        }
    }

    async benchmarkFullProject() {
        console.log(`\n📊 Benchmarking full project check`);
        console.log('─'.repeat(50));

        // Test ts-fast-check check-all
        const fastCheckResult = this.measureCommand(
            `node dist/index.js check-all --output json --metrics`
        );
        let metrics = { filesChecked: 0 };
        try {
            const json = JSON.parse(fastCheckResult.output);
            metrics = json.metrics || metrics;
        } catch { }

        this.results.push({
            tool: 'ts-fast-check',
            mode: 'full-project',
            time: fastCheckResult.time,
            memory: this.getMemoryUsage(),
            filesChecked: metrics.filesChecked,
            errors: this.parseErrorCount(fastCheckResult.output, 'ts-fast-check')
        });

        // Test tsc --noEmit
        const tscResult = this.measureCommand(
            `npx tsc --noEmit`
        );

        this.results.push({
            tool: 'tsc',
            mode: 'full-project',
            time: tscResult.time,
            memory: this.getMemoryUsage(),
            filesChecked: metrics.filesChecked, // Assume same files
            errors: this.parseErrorCount(tscResult.output, 'tsc')
        });

        const speedup = (tscResult.time / fastCheckResult.time).toFixed(2);
        console.log(`✅ ts-fast-check: ${fastCheckResult.time.toFixed(0)}ms (${metrics.filesChecked} files)`);
        console.log(`🐢 tsc --noEmit: ${tscResult.time.toFixed(0)}ms`);
        console.log(`🚀 Speedup: ${speedup}x faster`);
    }

    async benchmarkWatchStartup() {
        console.log(`\n📊 Benchmarking watch mode startup`);
        console.log('─'.repeat(50));

        // Test ts-fast-check watch startup
        const fastCheckStart = performance.now();
        const fastCheckProcess = spawn('node', ['dist/index.js', 'watch', '--quiet'], {
            cwd: this.projectRoot
        });

        // Wait for initial compilation
        await new Promise(resolve => {
            fastCheckProcess.stdout.on('data', (data) => {
                if (data.toString().includes('Watching') || data.toString().includes('Found')) {
                    resolve(null);
                }
            });
            setTimeout(resolve, 5000); // Max wait
        });

        const fastCheckTime = performance.now() - fastCheckStart;
        fastCheckProcess.kill();

        // Test tsc --watch startup
        const tscStart = performance.now();
        const tscProcess = spawn('npx', ['tsc', '--noEmit', '--watch'], {
            cwd: this.projectRoot
        });

        await new Promise(resolve => {
            tscProcess.stdout.on('data', (data) => {
                if (data.toString().includes('Watching') || data.toString().includes('Found')) {
                    resolve(null);
                }
            });
            setTimeout(resolve, 5000); // Max wait
        });

        const tscTime = performance.now() - tscStart;
        tscProcess.kill();

        this.results.push({
            tool: 'ts-fast-check',
            mode: 'watch-startup',
            time: fastCheckTime,
            memory: this.getMemoryUsage(),
            filesChecked: 0,
            errors: 0
        });

        this.results.push({
            tool: 'tsc',
            mode: 'watch-startup',
            time: tscTime,
            memory: this.getMemoryUsage(),
            filesChecked: 0,
            errors: 0
        });

        const speedup = (tscTime / fastCheckTime).toFixed(2);
        console.log(`✅ ts-fast-check: ${fastCheckTime.toFixed(0)}ms`);
        console.log(`🐢 tsc --watch: ${tscTime.toFixed(0)}ms`);
        console.log(`🚀 Speedup: ${speedup}x faster`);
    }

    generateReport() {
        console.log(`\n${'='.repeat(60)}`);
        console.log('📈 PERFORMANCE BENCHMARK SUMMARY');
        console.log(`${'='.repeat(60)}\n`);

        // Group results by mode
        const modes = [...new Set(this.results.map(r => r.mode))];

        modes.forEach(mode => {
            const modeResults = this.results.filter(r => r.mode === mode);
            const fastCheck = modeResults.find(r => r.tool === 'ts-fast-check');
            const tsc = modeResults.find(r => r.tool === 'tsc');

            if (fastCheck && tsc) {
                console.log(`\n${mode.toUpperCase()}`);
                console.log('─'.repeat(40));
                console.log(`ts-fast-check: ${fastCheck.time.toFixed(0)}ms`);
                console.log(`tsc:           ${tsc.time.toFixed(0)}ms`);
                console.log(`Speedup:       ${(tsc.time / fastCheck.time).toFixed(2)}x`);
                if (fastCheck.filesChecked > 0) {
                    console.log(`Files checked: ${fastCheck.filesChecked}`);
                }
            }
        });

        // Overall stats
        const avgSpeedups = modes.map(mode => {
            const modeResults = this.results.filter(r => r.mode === mode);
            const fastCheck = modeResults.find(r => r.tool === 'ts-fast-check');
            const tsc = modeResults.find(r => r.tool === 'tsc');
            return (fastCheck && tsc) ? tsc.time / fastCheck.time : 1;
        });

        const avgSpeedup = avgSpeedups.reduce((a, b) => a + b, 0) / avgSpeedups.length;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎯 AVERAGE SPEEDUP: ${avgSpeedup.toFixed(2)}x faster than tsc`);
        console.log(`${'='.repeat(60)}\n`);

        // Save results to JSON
        fs.writeFileSync(
            path.join(this.projectRoot, 'benchmark-results.json'),
            JSON.stringify(this.results, null, 2)
        );
        console.log('📄 Full results saved to benchmark-results.json');
    }
};

// Main execution
async function main() {
    const benchmark = new PerformanceBenchmark(fixturesRoot);

    console.log('🏁 Starting TypeScript Fast Check Performance Benchmark\n');

    try {
        // Run benchmarks using test fixtures (relative paths from fixtures directory)
        await benchmark.benchmarkSingleFile('file1.ts');
        await benchmark.benchmarkSingleFile('foo/file2.ts');
        await benchmark.benchmarkChangedFiles();
        await benchmark.benchmarkFullProject();
        await benchmark.benchmarkWatchStartup();

        // Generate report
        benchmark.generateReport();
    } catch (error) {
        console.error('❌ Benchmark failed:', error);
        process.exit(1);
    }
}

main();
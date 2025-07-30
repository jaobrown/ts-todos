/**
 * Watch mode latency benchmarks - measuring file change to JSON output time
 * This is critical for real-time agent workflows where latency matters more than throughput
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesRoot = path.join(__dirname, '../fixtures');
const cliPath = path.join(__dirname, '../../dist/index.js');

interface LatencyMeasurement {
    fileChangeTime: number;
    eventReceivedTime: number;
    latency: number;
    errors: number;
    filesChecked: number;
}

class WatchLatencyBenchmark {
    private watchProcess: ChildProcess | null = null;
    private testFilePath: string;
    private measurements: LatencyMeasurement[] = [];
    private pendingTests: Array<{ resolve: Function; reject: Function; startTime: number }> = [];

    constructor() {
        this.testFilePath = path.join(fixturesRoot, 'latency-test.ts');
    }

    async startWatchMode(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.watchProcess = spawn('node', [cliPath, 'watch', '--agent-mode', '--quiet', '--debounce', '50'], {
                cwd: fixturesRoot,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let startupSeen = false;

            this.watchProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                
                if (output.includes('Starting agent-optimized watch mode...')) {
                    startupSeen = true;
                    resolve();
                    return;
                }

                // Process JSON events
                const lines = output.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        if (event.event === 'check' && event.timestamp && event.result) {
                            this.handleEvent(event);
                        }
                    } catch (e) {
                        // Not JSON, ignore
                    }
                }
            });

            this.watchProcess.stderr?.on('data', (data) => {
                const error = data.toString();
                if (error.includes('Starting agent-optimized watch mode...')) {
                    startupSeen = true;
                    resolve();
                }
            });

            // Timeout
            setTimeout(() => {
                if (!startupSeen) {
                    reject(new Error('Watch mode failed to start'));
                }
            }, 3000);
        });
    }

    private handleEvent(event: any): void {
        const eventTime = Date.now();
        
        // Find the oldest pending test that matches
        const pendingTest = this.pendingTests.shift();
        if (pendingTest) {
            const latency = eventTime - pendingTest.startTime;
            
            this.measurements.push({
                fileChangeTime: pendingTest.startTime,
                eventReceivedTime: eventTime,
                latency,
                errors: event.result.errors.length,
                filesChecked: event.result.metrics.filesChecked
            });

            pendingTest.resolve(latency);
        }
    }

    async measureFileChangeLatency(content: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            this.pendingTests.push({ resolve, reject, startTime });
            
            // Write file change
            fs.writeFileSync(this.testFilePath, content);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                reject(new Error('Latency measurement timed out'));
            }, 5000);
        });
    }

    async runLatencyBenchmarks(): Promise<void> {
        console.log('🔥 Watch Mode Latency Benchmarks');
        console.log('=================================\n');

        // Start watch mode
        await this.startWatchMode();
        console.log('✓ Watch mode started\n');

        // Wait for initial setup
        await new Promise(resolve => setTimeout(resolve, 1000));

        const testCases = [
            {
                name: 'Simple syntax error',
                content: 'let myVar: number = "string";'
            },
            {
                name: 'Type mismatch error',
                content: `
function test(param: string): number {
    return param; // TS2322
}
export const result = test("hello");`
            },
            {
                name: 'Multiple errors in file',
                content: `
let a: number = "string"; // Error 1
let b: boolean = 123;     // Error 2
function wrong(x: string): number {
    return x; // Error 3
}
export { a, b, wrong };`
            },
            {
                name: 'Valid TypeScript (no errors)',
                content: `
interface User {
    name: string;
    age: number;
}
export const user: User = { name: "test", age: 25 };`
            },
            {
                name: 'Large file with error',
                content: `
// Large file simulation
${Array.from({ length: 50 }, (_, i) => `const var${i} = ${i};`).join('\n')}

// Error at the end
let errorVar: number = "string";
export { errorVar };`
            }
        ];

        console.log('Measuring latency for different file change scenarios:\n');

        for (const testCase of testCases) {
            try {
                const latency = await this.measureFileChangeLatency(testCase.content);
                console.log(`${testCase.name}:`);
                console.log(`  Latency: ${latency}ms`);
                
                const measurement = this.measurements[this.measurements.length - 1];
                console.log(`  Errors found: ${measurement.errors}`);
                console.log(`  Files checked: ${measurement.filesChecked}`);
                console.log('');
            } catch (error) {
                console.error(`❌ ${testCase.name}: ${error}`);
            }

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Rapid change test
        console.log('Testing rapid file changes (debouncing):');
        const rapidTestStart = Date.now();
        
        // Make rapid changes
        fs.writeFileSync(this.testFilePath, 'let a = 1;');
        setTimeout(() => fs.writeFileSync(this.testFilePath, 'let b = 2;'), 10);
        setTimeout(() => fs.writeFileSync(this.testFilePath, 'let c: number = "error";'), 20);
        
        // Wait for the debounced result
        try {
            const latency = await new Promise<number>((resolve, reject) => {
                this.pendingTests.push({ 
                    resolve, 
                    reject, 
                    startTime: rapidTestStart 
                });
                
                setTimeout(() => reject(new Error('Rapid change test timeout')), 2000);
            });
            
            console.log(`  Debounced latency: ${latency}ms`);
            console.log('  ✓ Successfully handled rapid changes\n');
        } catch (error) {
            console.error(`  ❌ Rapid change test failed: ${error}\n`);
        }

        this.printSummary();
        this.cleanup();
    }

    private printSummary(): void {
        if (this.measurements.length === 0) {
            console.log('❌ No measurements collected');
            return;
        }

        const latencies = this.measurements.map(m => m.latency);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

        console.log('📊 Latency Summary:');
        console.log('==================');
        console.log(`Average latency: ${avgLatency.toFixed(1)}ms`);
        console.log(`Min latency: ${minLatency}ms`);
        console.log(`Max latency: ${maxLatency}ms`);
        console.log(`P95 latency: ${p95Latency}ms`);
        console.log(`Total measurements: ${this.measurements.length}`);
        
        // Performance assessment
        console.log('\n🎯 Performance Assessment:');
        if (avgLatency < 100) {
            console.log('✅ Excellent - Sub-100ms average latency');
        } else if (avgLatency < 200) {
            console.log('✅ Good - Sub-200ms average latency');
        } else if (avgLatency < 500) {
            console.log('⚠️  Acceptable - Sub-500ms average latency');
        } else {
            console.log('❌ Poor - High latency may impact agent workflow');
        }

        // Agent workflow impact
        const dailySavings = this.calculateDailySavings(avgLatency);
        console.log(`\n⏱️  Agent Workflow Impact:`);
        console.log(`Real-time feedback: ${avgLatency.toFixed(1)}ms vs command-based: ~440ms`);
        console.log(`Time saved per check: ${(440 - avgLatency).toFixed(1)}ms`);
        console.log(`Daily impact (100 changes): ${dailySavings.toFixed(1)}s saved`);
    }

    private calculateDailySavings(avgLatency: number): number {
        const commandLatency = 440; // Average from our benchmarks
        const savingsPerCheck = Math.max(0, commandLatency - avgLatency);
        return (savingsPerCheck * 100) / 1000; // 100 checks per day in seconds
    }

    private cleanup(): void {
        if (this.watchProcess) {
            this.watchProcess.kill('SIGTERM');
            this.watchProcess = null;
        }

        if (fs.existsSync(this.testFilePath)) {
            fs.unlinkSync(this.testFilePath);
        }
    }
}

// Run benchmarks
async function main() {
    const benchmark = new WatchLatencyBenchmark();
    
    try {
        await benchmark.runLatencyBenchmarks();
    } catch (error) {
        console.error('Benchmark failed:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
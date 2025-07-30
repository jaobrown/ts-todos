/**
 * Integration tests for enhanced watch mode functionality using Node.js native test runner
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesRoot = path.join(__dirname, '../fixtures');
const cliPath = path.join(__dirname, '../../dist/index.js');

describe('Watch Mode Integration', () => {
    let watchProcess: ChildProcess | null = null;
    const testFilePath = path.join(fixturesRoot, 'watch-test.ts');

    const cleanup = () => {
        // Kill watch process if running
        if (watchProcess) {
            watchProcess.kill('SIGTERM');
            watchProcess = null;
        }
        
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    };

    test('should start agent mode watch successfully', (t, done) => {
        watchProcess = spawn('node', [cliPath, 'watch', '--agent-mode', '--quiet', '--debounce', '100'], {
            cwd: fixturesRoot,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        watchProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Starting agent-optimized watch mode...')) {
                cleanup();
                done();
            }
        });

        watchProcess.stderr?.on('data', (data) => {
            const error = data.toString();
            if (error.includes('Starting agent-optimized watch mode...')) {
                cleanup();
                done();
            }
        });

        // Timeout after 3 seconds
        setTimeout(() => {
            cleanup();
            done(new Error('Watch mode did not start within timeout'));
        }, 3000);
    });

    test('should output structured JSON events in agent mode', (t, done) => {
        // First create a file with errors
        fs.writeFileSync(testFilePath, `
let myVar: number = "string"; // Type error
export const testValue = myVar;
        `);

        watchProcess = spawn('node', [cliPath, 'watch', '--agent-mode', '--quiet', '--debounce', '100'], {
            cwd: fixturesRoot,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let startupSeen = false;
        let eventReceived = false;

        watchProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            
            if (output.includes('Starting agent-optimized watch mode...')) {
                startupSeen = true;
                return;
            }

            // Look for JSON event output
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    if (event.event === 'check' && event.timestamp && event.result) {
                        assert(event.result.hasOwnProperty('errors'), 'Event should have errors property');
                        assert(event.result.hasOwnProperty('metrics'), 'Event should have metrics property');
                        assert(typeof event.timestamp === 'number', 'Timestamp should be a number');
                        eventReceived = true;
                        cleanup();
                        done();
                        return;
                    }
                } catch (e) {
                    // Not JSON, continue
                }
            }
        });

        watchProcess.stderr?.on('data', (data) => {
            const error = data.toString();
            if (error.includes('Starting agent-optimized watch mode...')) {
                startupSeen = true;
            }
        });

        // Timeout after 5 seconds
        setTimeout(() => {
            cleanup();
            if (!startupSeen) {
                done(new Error('Watch mode did not start'));
            } else if (!eventReceived) {
                done(new Error('No structured JSON events received'));
            } else {
                done();
            }
        }, 5000);
    });

    test('should handle debouncing correctly', (t, done) => {
        let eventCount = 0;
        const events: any[] = [];

        watchProcess = spawn('node', [cliPath, 'watch', '--agent-mode', '--quiet', '--debounce', '200'], {
            cwd: fixturesRoot,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        watchProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            const lines = output.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                if (line.includes('Starting agent-optimized watch mode...')) continue;
                
                try {
                    const event = JSON.parse(line);
                    if (event.event === 'check') {
                        eventCount++;
                        events.push(event);
                    }
                } catch (e) {
                    // Not JSON, continue
                }
            }
        });

        // Wait for startup, then create rapid file changes
        setTimeout(() => {
            // Rapid file changes (should be debounced)
            fs.writeFileSync(testFilePath, 'let a: number = 1;');
            setTimeout(() => fs.writeFileSync(testFilePath, 'let b: number = 2;'), 50);
            setTimeout(() => fs.writeFileSync(testFilePath, 'let c: number = 3;'), 100);
            
            // Check results after debounce period
            setTimeout(() => {
                cleanup();
                // Should have received limited events due to debouncing
                assert(eventCount < 3, `Expected fewer than 3 events, got ${eventCount}`);
                assert(eventCount > 0, `Expected at least 1 event, got ${eventCount}`);
                done();
            }, 500);
        }, 1000);

        // Overall timeout
        setTimeout(() => {
            cleanup();
            done(new Error('Debouncing test timed out'));
        }, 3000);
    });
});
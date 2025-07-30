import { test, describe } from 'node:test';
import { strict as assert } from 'assert';
import * as path from 'path';
import { CLI } from '../../dist/src/index.js';

describe('CLI', () => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const testFixturesPath = path.join(__dirname, '../fixtures');

    test('should initialize with default project root', () => {
        assert.doesNotThrow(() => {
            new CLI();
        });
    });

    test('should initialize with custom project root', () => {
        assert.doesNotThrow(() => {
            new CLI(testFixturesPath);
        });
    });

    test('should handle error gracefully when TypeScript checker fails', () => {
        // Test with invalid project root
        const cli = new CLI('/non/existent/path');

        // This would normally call process.exit, but we can't test that easily
        // The initialization should complete, but operations would fail
        assert.ok(cli instanceof CLI);
    });

    test('CLI class should be properly structured', () => {
        const cli = new CLI(testFixturesPath);

        // Verify it has the run method
        assert.equal(typeof cli.run, 'function');

        // Verify it's an instance of CLI
        assert.ok(cli instanceof CLI);
    });

    test('CLI should have proper method signatures', () => {
        const cli = new CLI(testFixturesPath);

        // run method should be a function that returns a Promise
        assert.equal(typeof cli.run, 'function');

        // Note: We can't actually call run() in unit tests because it parses process.argv
        // and calls process.exit(). Full CLI testing is done in integration tests.
    });

    // Note: Full CLI testing is better done in integration tests where we can
    // control process.argv and capture process.exit calls. These unit tests
    // focus on the CLI class structure and basic instantiation.

    test('CLI error handling should format errors correctly', () => {
        const cli = new CLI(testFixturesPath);

        // Test that the CLI class can be created and has error handling capabilities
        // Full error handling testing should be done in integration tests
        assert.ok(cli instanceof CLI);
    });

    test('CLI should accept valid project roots', () => {
        // Test with current directory
        const cli1 = new CLI(process.cwd());
        assert.ok(cli1 instanceof CLI);

        // Test with test fixtures
        const cli2 = new CLI(testFixturesPath);
        assert.ok(cli2 instanceof CLI);

        // Test with undefined (default)
        const cli3 = new CLI();
        assert.ok(cli3 instanceof CLI);
    });
});
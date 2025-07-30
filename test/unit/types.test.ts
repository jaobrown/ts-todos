import { test, describe } from 'node:test';
import { strict as assert } from 'assert';
import type { TypeScriptError, CheckResult, CLIOptions, OutputFormat, CheckerOptions } from '../../src/types.ts';

describe('Types', () => {
    test('TypeScriptError interface should have correct structure', () => {
        const error: TypeScriptError = {
            file: 'test.ts',
            line: 10,
            column: 5,
            code: 'TS2322',
            message: "Type 'string' is not assignable to type 'number'.",
            severity: 'error'
        };

        // Verify all required properties exist
        assert.equal(typeof error.file, 'string');
        assert.equal(typeof error.line, 'number');
        assert.equal(typeof error.column, 'number');
        assert.equal(typeof error.code, 'string');
        assert.equal(typeof error.message, 'string');
        assert.ok(error.severity === 'error' || error.severity === 'warning');
    });

    test('TypeScriptError should accept warning severity', () => {
        const warning: TypeScriptError = {
            file: 'test.ts',
            line: 1,
            column: 1,
            code: 'TS6133',
            message: 'Variable is declared but never read.',
            severity: 'warning'
        };

        assert.equal(warning.severity, 'warning');
    });

    test('CheckResult interface should have correct structure', () => {
        const result: CheckResult = {
            errors: [],
            metrics: {
                checkTime: 100,
                filesChecked: 5,
                totalErrors: 0
            }
        };

        assert.ok(Array.isArray(result.errors));
        assert.equal(typeof result.metrics?.checkTime, 'number');
        assert.equal(typeof result.metrics?.filesChecked, 'number');
        assert.equal(typeof result.metrics?.totalErrors, 'number');
    });

    test('CheckResult should work without metrics', () => {
        const result: CheckResult = {
            errors: []
        };

        assert.ok(Array.isArray(result.errors));
        assert.equal(result.metrics, undefined);
    });

    test('CLIOptions should have correct structure', () => {
        const options: CLIOptions = {
            _: ['check'],
            file: 'test.ts',
            output: 'json',
            quiet: true,
            metrics: false,
            'no-cache': false
        };

        assert.ok(Array.isArray(options._));
        assert.equal(typeof options.file, 'string');
        assert.ok(['json', 'cli', 'markdown'].includes(options.output));
        assert.equal(typeof options.quiet, 'boolean');
        assert.equal(typeof options.metrics, 'boolean');
        assert.equal(typeof options['no-cache'], 'boolean');
    });

    test('CLIOptions should work with optional file', () => {
        const options: CLIOptions = {
            _: ['check-all'],
            output: 'cli',
            quiet: false,
            metrics: true,
            'no-cache': false
        };

        assert.equal(options.file, undefined);
        assert.ok(Array.isArray(options._));
    });

    test('OutputFormat should only accept valid values', () => {
        const validFormats: OutputFormat[] = ['json', 'cli', 'markdown'];

        validFormats.forEach(format => {
            const testFormat: OutputFormat = format;
            assert.ok(['json', 'cli', 'markdown'].includes(testFormat));
        });
    });

    test('CheckerOptions should have correct structure', () => {
        const options: CheckerOptions = {
            projectRoot: '/path/to/project',
            noCache: true
        };

        assert.equal(typeof options.projectRoot, 'string');
        assert.equal(typeof options.noCache, 'boolean');
    });

    test('CheckerOptions should work with minimal config', () => {
        const options: CheckerOptions = {
            projectRoot: '/path/to/project'
        };

        assert.equal(typeof options.projectRoot, 'string');
        assert.equal(options.noCache, undefined);
    });

    test('Type guards should work correctly', () => {
        // Test that we can distinguish between error and warning
        const error: TypeScriptError = {
            file: 'test.ts',
            line: 1,
            column: 1,
            code: 'TS2322',
            message: 'Type error',
            severity: 'error'
        };

        const warning: TypeScriptError = {
            file: 'test.ts',
            line: 1,
            column: 1,
            code: 'TS6133',
            message: 'Warning message',
            severity: 'warning'
        };

        assert.equal(error.severity === 'error', true);
        assert.equal(warning.severity === 'warning', true);
        assert.equal(error.severity === 'warning', false);
        assert.equal(warning.severity === 'error', false);
    });
});
import { test, describe } from 'node:test';
import { strict as assert } from 'assert';
import { OutputFormatter } from '../../dist/src/index.js';
import type { CheckResult, TypeScriptError } from '../../dist/src/index.js';

describe('OutputFormatter', () => {
    const sampleError: TypeScriptError = {
        file: 'test.ts',
        line: 10,
        column: 5,
        code: 'TS2322',
        message: "Type 'string' is not assignable to type 'number'.",
        severity: 'error'
    };

    const sampleResult: CheckResult = {
        errors: [sampleError],
        metrics: {
            checkTime: 45,
            filesChecked: 1,
            totalErrors: 1
        }
    };

    const emptyResult: CheckResult = {
        errors: [],
        metrics: {
            checkTime: 20,
            filesChecked: 1,
            totalErrors: 0
        }
    };

    test('JSON formatter should format errors correctly', () => {
        const output = OutputFormatter.format(sampleResult, 'json', true);
        const parsed = JSON.parse(output);

        assert.equal(parsed.errors.length, 1);
        assert.equal(parsed.errors[0].file, 'test.ts');
        assert.equal(parsed.errors[0].line, 10);
        assert.equal(parsed.errors[0].code, 'TS2322');
        assert.equal(parsed.metrics.checkTime, 45);
    });

    test('JSON formatter should exclude metrics when showMetrics is false', () => {
        const output = OutputFormatter.format(sampleResult, 'json', false);
        const parsed = JSON.parse(output);

        assert.equal(parsed.errors.length, 1);
        assert.equal(parsed.metrics, undefined);
    });

    test('CLI formatter should show success message for no errors', () => {
        const output = OutputFormatter.format(emptyResult, 'cli', false);
        assert.ok(output.includes('✓ No TypeScript errors found'));
    });

    test('CLI formatter should show error count and details', () => {
        const output = OutputFormatter.format(sampleResult, 'cli', false);
        assert.ok(output.includes('Found 1 TypeScript error'));
        assert.ok(output.includes('test.ts'));
        assert.ok(output.includes('10:5 TS2322'));
        assert.ok(output.includes("Type 'string' is not assignable"));
    });

    test('CLI formatter should include metrics when requested', () => {
        const output = OutputFormatter.format(sampleResult, 'cli', true);
        assert.ok(output.includes('Checked 1 file(s) in 45ms'));
    });

    test('Markdown formatter should format errors correctly', () => {
        const output = OutputFormatter.format(sampleResult, 'markdown', false);
        assert.ok(output.includes('## TypeScript Errors (1)'));
        assert.ok(output.includes('### test.ts'));
        assert.ok(output.includes('**Line 10, Column 5** (TS2322)'));
        assert.ok(output.includes("Type 'string' is not assignable"));
    });

    test('Markdown formatter should show success message for no errors', () => {
        const output = OutputFormatter.format(emptyResult, 'markdown', false);
        assert.ok(output.includes('## ✓ No TypeScript errors found'));
    });

    test('Multiple errors should be grouped by file', () => {
        const multiError: CheckResult = {
            errors: [
                { ...sampleError, file: 'file1.ts', line: 1 },
                { ...sampleError, file: 'file1.ts', line: 5 },
                { ...sampleError, file: 'file2.ts', line: 10 }
            ],
            metrics: { checkTime: 100, filesChecked: 2, totalErrors: 3 }
        };

        const output = OutputFormatter.format(multiError, 'cli', false);
        assert.ok(output.includes('Found 3 TypeScript errors'));
        assert.ok(output.includes('file1.ts'));
        assert.ok(output.includes('file2.ts'));
        assert.ok(output.includes('1:5 TS2322'));
        assert.ok(output.includes('5:5 TS2322'));
        assert.ok(output.includes('10:5 TS2322'));
    });

    test('Warning severity should be handled differently from errors', () => {
        const warningResult: CheckResult = {
            errors: [{
                ...sampleError,
                severity: 'warning',
                message: 'This is a warning'
            }],
            metrics: { checkTime: 30, filesChecked: 1, totalErrors: 1 }
        };

        const output = OutputFormatter.format(warningResult, 'cli', false);
        assert.ok(output.includes('This is a warning'));
    });
});
import { test, describe } from 'node:test';
import { strict as assert } from 'assert';
import * as path from 'path';
import { TypeScriptFastChecker } from '../../dist/src/index.js';
import type { CheckerOptions } from '../../dist/src/index.js';

describe('TypeScriptFastChecker', () => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const testFixturesPath = path.join(__dirname, '../fixtures');
    let checker: TypeScriptFastChecker;

    // Setup checker for each test
    const setupChecker = (options?: Partial<CheckerOptions>) => {
        return new TypeScriptFastChecker({
            projectRoot: testFixturesPath,
            ...options
        });
    };

    test('should initialize with valid project root', () => {
        assert.doesNotThrow(() => {
            checker = setupChecker();
        });
    });

    test('checkFile should return errors for file with type errors', () => {
        checker = setupChecker();
        const result = checker.checkFile('file1.ts');

        assert.ok(result.errors.length > 0);
        assert.equal(typeof result.metrics?.checkTime, 'number');
        assert.equal(result.metrics?.filesChecked, 1);
        assert.equal(result.metrics?.totalErrors, result.errors.length);

        // Check that we have the expected type errors
        const error = result.errors[0];
        assert.equal(error.file, 'file1.ts');
        assert.ok(error.line > 0);
        assert.ok(error.column > 0);
        assert.ok(error.code.startsWith('TS'));
        assert.ok(error.message.length > 0);
        assert.ok(['error', 'warning'].includes(error.severity));
    });

    test('checkFile should return no errors for valid file', () => {
        checker = setupChecker();
        const result = checker.checkFile('valid.ts');

        assert.equal(result.errors.length, 0);
        assert.equal(result.metrics?.filesChecked, 1);
        assert.equal(result.metrics?.totalErrors, 0);
        assert.ok(result.metrics!.checkTime >= 0);
    });

    test('checkFile should throw error for non-existent file', () => {
        checker = setupChecker();

        assert.throws(() => {
            checker.checkFile('non-existent.ts');
        }, /File not found/);
    });

    test('checkFile should handle absolute paths', () => {
        checker = setupChecker();
        const absolutePath = path.join(testFixturesPath, 'valid.ts');
        const result = checker.checkFile(absolutePath);

        assert.equal(result.errors.length, 0);
        assert.equal(result.metrics?.filesChecked, 1);
    });

    test('checkAll should check all files in project', () => {
        checker = setupChecker();
        const result = checker.checkAll();

        // Should find files and errors
        assert.ok(result.metrics!.filesChecked >= 2); // At least file1.ts and valid.ts
        assert.ok(result.errors.length >= 2); // file1.ts has 2+ errors
        assert.equal(result.metrics?.totalErrors, result.errors.length);
        assert.ok(result.metrics!.checkTime >= 0);
    });

    test('checkAll should exclude library files from count', () => {
        checker = setupChecker();
        const result = checker.checkAll();

        // Should only count user source files, not library files
        assert.ok(result.metrics!.filesChecked < 20); // Should be small number, not 100+

        // Verify no library files in errors
        result.errors.forEach(error => {
            assert.ok(!error.file.includes('lib.'));
            assert.ok(!error.file.includes('node_modules'));
        });
    });

    test('error formatting should include all required fields', () => {
        checker = setupChecker();
        const result = checker.checkFile('file1.ts');

        result.errors.forEach(error => {
            assert.equal(typeof error.file, 'string');
            assert.equal(typeof error.line, 'number');
            assert.equal(typeof error.column, 'number');
            assert.equal(typeof error.code, 'string');
            assert.equal(typeof error.message, 'string');
            assert.ok(['error', 'warning'].includes(error.severity));

            // Verify reasonable values
            assert.ok(error.line > 0);
            assert.ok(error.column > 0);
            assert.ok(error.code.startsWith('TS'));
            assert.ok(error.message.length > 0);
        });
    });

    test('relative paths should be calculated correctly', () => {
        checker = setupChecker();
        const result = checker.checkFile('foo/file2.ts');

        if (result.errors.length > 0) {
            const error = result.errors[0];
            assert.equal(error.file, 'foo/file2.ts');
        }
    });

    test('checker should handle files in subdirectories', () => {
        checker = setupChecker();
        const result = checker.checkFile('foo/file2.ts');

        assert.ok(result.errors.length > 0);
        assert.equal(result.metrics?.filesChecked, 1);
    });

    test('performance metrics should be reasonable', () => {
        checker = setupChecker();
        const start = Date.now();
        const result = checker.checkFile('valid.ts');
        const actualTime = Date.now() - start;

        // Reported time should be close to actual time
        assert.ok(result.metrics!.checkTime <= actualTime + 10); // Allow 10ms tolerance
        assert.ok(result.metrics!.checkTime >= 0);

        // Should be reasonably fast
        assert.ok(result.metrics!.checkTime < 1000); // Less than 1 second
    });

    test('multiple checks should work consistently', () => {
        checker = setupChecker();

        const result1 = checker.checkFile('file1.ts');
        const result2 = checker.checkFile('file1.ts');

        // Should get same errors (caching might make second faster)
        assert.equal(result1.errors.length, result2.errors.length);
        assert.equal(result1.metrics?.filesChecked, result2.metrics?.filesChecked);
        assert.equal(result1.metrics?.totalErrors, result2.metrics?.totalErrors);
    });
});
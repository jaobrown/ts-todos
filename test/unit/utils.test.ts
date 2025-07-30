import { test, describe } from 'node:test';
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
    isReadableFile,
    getRelativePath,
    measureTime,
    isTypeScriptProject,
    findTsConfig
} from '../../dist/src/index.js';

describe('Utils', () => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const testFixturesPath = path.join(__dirname, '../fixtures');

    test('isReadableFile should return true for existing readable files', () => {
        const testFile = path.join(testFixturesPath, 'file1.ts');
        assert.equal(isReadableFile(testFile), true);
    });

    test('isReadableFile should return false for non-existent files', () => {
        const nonExistentFile = path.join(testFixturesPath, 'non-existent.ts');
        assert.equal(isReadableFile(nonExistentFile), false);
    });

    test('getRelativePath should return correct relative path', () => {
        const projectRoot = '/Users/test/project';
        const filePath = '/Users/test/project/src/index.ts';
        const result = getRelativePath(projectRoot, filePath);
        assert.equal(result, 'src/index.ts');
    });

    test('getRelativePath should handle same directory', () => {
        const projectRoot = '/Users/test/project';
        const filePath = '/Users/test/project/file.ts';
        const result = getRelativePath(projectRoot, filePath);
        assert.equal(result, 'file.ts');
    });

    test('measureTime should measure execution time', async () => {
        const testFunction = () => {
            // Simulate some work
            let sum = 0;
            for (let i = 0; i < 1000; i++) {
                sum += i;
            }
            return sum;
        };

        const { result, time } = await measureTime(testFunction);

        assert.equal(result, 499500); // Sum of 0 to 999
        assert.ok(time >= 0);
        assert.ok(time < 100); // Should be very fast
    });

    test('measureTime should work with async functions', async () => {
        const asyncFunction = async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return 'done';
        };

        const { result, time } = await measureTime(asyncFunction);

        assert.equal(result, 'done');
        assert.ok(time >= 10); // Should be at least 10ms
        assert.ok(time < 50);  // But not too long
    });

    test('isTypeScriptProject should return true for directories with tsconfig.json', () => {
        const result = isTypeScriptProject(testFixturesPath);
        assert.equal(result, true);
    });

    test('isTypeScriptProject should return false for directories without tsconfig.json', () => {
        const tempDir = path.join(__dirname, '../temp-no-tsconfig');

        // Create temporary directory without tsconfig.json
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const result = isTypeScriptProject(tempDir);
        assert.equal(result, false);

        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('findTsConfig should return path to tsconfig.json when it exists', () => {
        const result = findTsConfig(testFixturesPath);
        assert.equal(result, path.join(testFixturesPath, 'tsconfig.json'));
    });

    test('findTsConfig should return null when tsconfig.json does not exist', () => {
        const tempDir = path.join(__dirname, '../temp-no-config');

        // Create temporary directory without tsconfig.json
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const result = findTsConfig(tempDir);
        assert.equal(result, null);

        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('utility functions should handle edge cases gracefully', () => {
        // Test with empty strings
        assert.equal(getRelativePath('', ''), '');
        assert.equal(getRelativePath('/test', '/test'), '');

        // Test isReadableFile with empty string
        assert.equal(isReadableFile(''), false);

        // Test TypeScript project detection with empty string (current directory)
        // Empty string points to current directory, which has tsconfig.json
        assert.equal(isTypeScriptProject(''), true);
        assert.ok(findTsConfig('') !== null);
    });
});
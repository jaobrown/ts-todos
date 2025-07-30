/**
 * Utility functions for ts-fast-check
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get list of files changed according to git
 */
export const getChangedFiles = (projectRoot: string): string[] => {
    try {
        const gitStatus = execSync('git status --porcelain', { cwd: projectRoot }).toString();
        return gitStatus
            .split('\n')
            .filter(line => line.length > 0)
            .map(line => line.substring(3).trim())
            .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
            .map(file => path.join(projectRoot, file));
    } catch (error) {
        throw new Error('Not a git repository or git command failed');
    }
};

/**
 * Check if a file exists and is readable
 */
export const isReadableFile = (filePath: string): boolean => {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
};

/**
 * Get relative path from project root
 */
export const getRelativePath = (projectRoot: string, filePath: string): string => {
    return path.relative(projectRoot, filePath);
};

/**
 * Measure execution time of a function
 */
export const measureTime = async <T>(fn: () => T | Promise<T>): Promise<{ result: T; time: number }> => {
    const start = Date.now();
    const result = await fn();
    const time = Date.now() - start;
    return { result, time };
};

/**
 * Check if the current directory is a TypeScript project
 */
export const isTypeScriptProject = (projectRoot: string): boolean => {
    const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
    return fs.existsSync(tsConfigPath);
};

/**
 * Find TypeScript config file
 */
export const findTsConfig = (projectRoot: string): string | null => {
    const configPath = path.join(projectRoot, 'tsconfig.json');
    return fs.existsSync(configPath) ? configPath : null;
};
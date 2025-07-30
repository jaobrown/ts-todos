/**
 * Core type definitions for ts-fast-check
 */

export interface TypeScriptError {
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface CheckResult {
    errors: TypeScriptError[];
    metrics?: {
        checkTime: number;
        filesChecked: number;
        totalErrors: number;
    };
}

export interface CLIOptions {
    _: string[];
    file?: string;
    output: 'json' | 'cli' | 'markdown';
    quiet: boolean;
    metrics: boolean;
    'no-cache': boolean;
    'agent-mode'?: boolean;
    debounce?: number;
}

export type OutputFormat = 'json' | 'cli' | 'markdown';

export interface CheckerOptions {
    projectRoot: string;
    noCache?: boolean;
}
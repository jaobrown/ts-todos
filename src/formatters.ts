/**
 * Output formatters for different output modes
 */

import chalk from 'chalk';
import { CheckResult, TypeScriptError, OutputFormat } from './types.js';

export class OutputFormatter {
    static format(result: CheckResult, format: OutputFormat, showMetrics: boolean = false): string {
        switch (format) {
            case 'json':
                return OutputFormatter.formatJSON(result, showMetrics);
            case 'markdown':
                return OutputFormatter.formatMarkdown(result, showMetrics);
            case 'cli':
            default:
                return OutputFormatter.formatCLI(result, showMetrics);
        }
    }

    static print(result: CheckResult, format: OutputFormat, showMetrics: boolean = false): void {
        const output = OutputFormatter.format(result, format, showMetrics);
        console.log(output);
    }

    private static formatJSON(result: CheckResult, showMetrics: boolean): string {
        const output = { ...result };
        if (!showMetrics) {
            delete output.metrics;
        }
        return JSON.stringify(output, null, 2);
    }

    private static formatCLI(result: CheckResult, showMetrics: boolean): string {
        let output = '';

        if (result.errors.length === 0) {
            output = chalk.green('✓ No TypeScript errors found');
        } else {
            output += chalk.red.bold(`Found ${result.errors.length} TypeScript error${result.errors.length > 1 ? 's' : ''}:\n\n`);

            const errorsByFile: Record<string, TypeScriptError[]> = {};
            result.errors.forEach(error => {
                if (!errorsByFile[error.file]) {
                    errorsByFile[error.file] = [];
                }
                errorsByFile[error.file].push(error);
            });

            Object.entries(errorsByFile).forEach(([file, errors]) => {
                output += chalk.underline(file) + '\n';
                errors.forEach(error => {
                    const color = error.severity === 'error' ? chalk.red : chalk.yellow;
                    output += color(`  ${error.line}:${error.column} ${error.code} ${error.message}`) + '\n';
                });
                output += '\n';
            });
        }

        if (showMetrics && result.metrics) {
            output += chalk.gray(`\nChecked ${result.metrics.filesChecked} file(s) in ${result.metrics.checkTime}ms`);
        }

        return output.trim();
    }

    private static formatMarkdown(result: CheckResult, showMetrics: boolean): string {
        let output = '';

        if (result.errors.length === 0) {
            output = '## ✓ No TypeScript errors found\n';
        } else {
            output += `## TypeScript Errors (${result.errors.length})\n\n`;

            const errorsByFile: Record<string, TypeScriptError[]> = {};
            result.errors.forEach(error => {
                if (!errorsByFile[error.file]) {
                    errorsByFile[error.file] = [];
                }
                errorsByFile[error.file].push(error);
            });

            Object.entries(errorsByFile).forEach(([file, errors]) => {
                output += `### ${file}\n\n`;
                errors.forEach(error => {
                    output += `- **Line ${error.line}, Column ${error.column}** (${error.code}): ${error.message}\n`;
                });
                output += '\n';
            });
        }

        if (showMetrics && result.metrics) {
            output += `\n---\n*Checked ${result.metrics.filesChecked} file(s) in ${result.metrics.checkTime}ms*`;
        }

        return output.trim();
    }
}
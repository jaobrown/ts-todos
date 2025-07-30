#!/usr/bin/env node

/**
 * CLI interface for ts-fast-check
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ts from 'typescript';
import { TypeScriptFastChecker } from './typescript-checker.js';
import { OutputFormatter } from './formatters.js';
import { CLIOptions, CheckResult, OutputFormat } from './types.js';

export class CLI {
    private checker: TypeScriptFastChecker;
    private projectRoot: string;

    constructor(projectRoot: string = process.cwd()) {
        this.projectRoot = projectRoot;
        this.checker = new TypeScriptFastChecker({ projectRoot });
    }

    /**
     * Parse command line arguments and execute the appropriate command
     */
    async run(): Promise<void> {
        const argv = yargs(hideBin(process.argv))
            .scriptName('ts-fast-check')
            .usage('$0 <command> [options]')
            .command('check <file>', 'Check a specific TypeScript file', (yargs) => {
                return yargs.positional('file', {
                    describe: 'Path to the TypeScript file to check',
                    type: 'string'
                });
            })
            .command('check-changed', 'Check all changed files (according to git)')
            .command('check-all', 'Check all files in the project')
            .command('watch', 'Watch for file changes and check continuously')
            .option('output', {
                type: 'string',
                choices: ['json', 'cli', 'markdown'] as const,
                default: 'cli',
                description: 'Output format'
            })
            .option('quiet', {
                type: 'boolean',
                default: false,
                description: 'Only output on errors'
            })
            .option('metrics', {
                type: 'boolean',
                default: false,
                description: 'Include performance metrics'
            })
            .option('no-cache', {
                type: 'boolean',
                default: false,
                description: 'Disable caching'
            })
            .help()
            .alias('help', 'h')
            .version()
            .alias('version', 'v')
            .argv as CLIOptions;

        const command = argv._[0];
        const outputFormat = argv.output;
        const quiet = argv.quiet;
        const showMetrics = argv.metrics;

        try {
            let result: CheckResult | null = null;
            let exitCode = 0;

            switch (command) {
                case 'check':
                    if (argv.file) {
                        result = this.checker.checkFile(argv.file);
                    }
                    break;

                case 'check-changed':
                    result = this.checker.checkChangedFiles();
                    break;

                case 'check-all':
                    result = this.checker.checkAll();
                    break;

                case 'watch':
                    await this.runWatchMode(outputFormat, quiet, showMetrics);
                    return;

                default:
                    console.error('Please specify a command: check, check-changed, check-all, or watch');
                    process.exit(2);
            }

            if (result) {
                exitCode = result.errors.length > 0 ? 1 : 0;

                if (!quiet || result.errors.length > 0) {
                    OutputFormatter.print(result, outputFormat, showMetrics);
                }
            }

            process.exit(exitCode);

        } catch (error) {
            this.handleError(error as Error, outputFormat);
            process.exit(2);
        }
    }

    private async runWatchMode(outputFormat: OutputFormat, quiet: boolean, showMetrics: boolean): Promise<void> {
        console.log('Starting watch mode...');

        this.checker.watch(
            (result: CheckResult) => {
                if (!quiet || result.errors.length > 0) {
                    if (outputFormat === 'json') {
                        console.log(JSON.stringify(result, null, 2));
                    } else {
                        OutputFormatter.print(result, outputFormat, showMetrics);
                    }
                }
            },
            (diagnostic: ts.Diagnostic) => {
                // Status change messages (compilation started, etc.)
                if (!quiet) {
                    console.info(ts.formatDiagnostic(diagnostic, {
                        getCanonicalFileName: path => path,
                        getCurrentDirectory: ts.sys.getCurrentDirectory,
                        getNewLine: () => ts.sys.newLine,
                    }));
                }
            }
        );
    }

    private handleError(error: Error, outputFormat: OutputFormat): void {
        if (outputFormat === 'json') {
            console.error(JSON.stringify({ error: error.message }, null, 2));
        } else {
            console.error(`Error: ${error.message}`);
        }
    }
}

// Main execution when run directly (ES modules don't have require.main)
// This module is only imported when used as CLI, so it's safe to always run
// The actual entry point is in /index.ts which controls execution
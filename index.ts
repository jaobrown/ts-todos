#!/usr/bin/env node

import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface ArgvInterface {
    'hide-error-messages': boolean;
    'output-markdown': boolean;
    'no-cli-output': boolean;
    'output-file': string | undefined;
}

const argv = yargs(hideBin(process.argv))
    .option('output-markdown', {
        alias: 'm',
        type: 'boolean',
        description: 'Output errors to a markdown file',
        default: false
    })
    .option('no-cli-output', {
        alias: 'c',
        type: 'boolean',
        description: 'Do not print to CLI',
        default: false
    })
    .option('hide-error-messages', {
        alias: 'h',
        type: 'boolean',
        description: 'Do not show error messages in the CLI',
        default: false
    })
    .option('output-file', {
        alias: 'o',
        type: 'string',
        description: 'Specify the name of the output markdown file',
        requiresArg: true
    })
    .parse() as ArgvInterface;

const projectRoot = process.cwd();

// display in the CLI
const displayDiagnosticsInCLI = (diagnostics: readonly ts.Diagnostic[], projectRoot: string) => {
    console.clear();
    console.log(chalk.blue.bold('TypeScript Error Tracker\n'));

    const errorsByFile: Record<string, ts.Diagnostic[]> = {};

    diagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            const filePath = diagnostic.file.fileName;
            errorsByFile[filePath] = errorsByFile[filePath] || [];
            errorsByFile[filePath].push(diagnostic);
        }
    });

    Object.keys(errorsByFile).forEach(filePath => {
        const relativeFilePath = path.relative(projectRoot, filePath);
        console.log(chalk.underline(relativeFilePath), '\n');

        if (!argv['hide-error-messages']) {
            let errorMessages = errorsByFile[filePath].map(diagnostic => {
                if (diagnostic.file) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0);
                    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    return `Line ${line + 1}, Character ${character + 1}: ${message}`;
                }
                return '';
            }).filter(message => message.length > 0).join('\n\n');

            if (errorMessages.length > 0) {
                console.log(chalk.red(errorMessages));
            }

            console.log('\n');
        }
    });
}

// format for markdown
const formatDiagnosticsForMarkdown = (diagnostics: readonly ts.Diagnostic[], projectRoot: string): string => {
    const errorsByFile: Record<string, ts.Diagnostic[]> = {};

    diagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            const filePath = diagnostic.file.fileName;
            if (!errorsByFile[filePath]) {
                errorsByFile[filePath] = [];
            }
            errorsByFile[filePath].push(diagnostic);
        }
    });

    let markdownOutput = "Todo list:\n";

    Object.keys(errorsByFile).forEach(filePath => {
        const relativeFilePath = path.relative(projectRoot, filePath);
        markdownOutput += `\n${relativeFilePath}\n`;

        errorsByFile[filePath].forEach(diagnostic => {
            if (diagnostic.file) {
                const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0);
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                markdownOutput += `- Line ${line + 1}, Character ${character + 1}: ${message}\n`;
            }
        });
    });

    return markdownOutput;
}

const writeMarkdownToFile = (markdownContent: string, projectRoot: string, outputFileName: string) => {
    const filePath = path.join(projectRoot, outputFileName);
    fs.writeFileSync(filePath, markdownContent);
    console.info(`Errors written to ${filePath}`);
}

const formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
};

const reportWatchStatusChanged = (diagnostic: ts.Diagnostic) => {
    console.info(ts.formatDiagnostic(diagnostic, formatHost));
}

const host = ts.createWatchCompilerHost(
    path.join(projectRoot, 'tsconfig.json'),
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    (_diagnostic) => {
        // can re-enable this if we want to report diagnostics
        // but pointless since we do via md or cli anyways
        // reportDiagnostic(diagnostic);
    },
    reportWatchStatusChanged
);

const origCreateProgram = host.createProgram;
host.createProgram = (rootNames, options, host, oldProgram) => {
    const program = origCreateProgram(rootNames, options, host, oldProgram);
    const diagnostics = ts.getPreEmitDiagnostics(program.getProgram());

    // skip CLI output if flag is set
    if (!argv['no-cli-output']) {
        displayDiagnosticsInCLI(diagnostics, projectRoot);
    }

    // Write to Markdown if enabled
    if (argv['output-markdown']) {
        const outputFileName = argv['output-file'] || 'ts-todos.md';
        const markdownOutput = formatDiagnosticsForMarkdown(diagnostics, projectRoot);
        writeMarkdownToFile(markdownOutput, projectRoot, outputFileName);
    }

    return program;
};

ts.createWatchProgram(host);
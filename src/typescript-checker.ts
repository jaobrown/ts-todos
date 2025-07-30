/**
 * Core TypeScript checking functionality using TypeScript Language Service
 */

import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { CheckResult, TypeScriptError, CheckerOptions } from './types.js';

export class TypeScriptFastChecker {
    private service: ts.LanguageService;
    private program: ts.Program;
    private host: ts.LanguageServiceHost;
    private files: Map<string, { version: number; snapshot: ts.IScriptSnapshot }> = new Map();
    private projectRoot: string;
    private configPath: string;
    private compilerOptions: ts.CompilerOptions;

    constructor(options: CheckerOptions) {
        this.projectRoot = options.projectRoot;
        this.configPath = ts.findConfigFile(this.projectRoot, ts.sys.fileExists, 'tsconfig.json') ||
            path.join(this.projectRoot, 'tsconfig.json');

        const configFile = ts.readConfigFile(this.configPath, ts.sys.readFile);
        const parsedConfig = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            this.projectRoot
        );
        this.compilerOptions = parsedConfig.options;

        this.host = this.createLanguageServiceHost();
        this.service = ts.createLanguageService(this.host, ts.createDocumentRegistry());
        this.program = this.service.getProgram()!;
    }

    /**
     * Check a specific file for TypeScript errors
     */
    checkFile(filePath: string): CheckResult {
        const startTime = Date.now();
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }

        // Update the file snapshot
        this.updateFile(absolutePath);

        // Get diagnostics for the specific file
        const syntacticDiagnostics = this.service.getSyntacticDiagnostics(absolutePath);
        const semanticDiagnostics = this.service.getSemanticDiagnostics(absolutePath);
        const allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics];

        const errors: TypeScriptError[] = allDiagnostics
            .filter(d => d.category === ts.DiagnosticCategory.Error || d.category === ts.DiagnosticCategory.Warning)
            .map(diagnostic => this.formatDiagnostic(diagnostic))
            .filter((error): error is TypeScriptError => error !== null);

        const checkTime = Date.now() - startTime;

        return {
            errors,
            metrics: {
                checkTime,
                filesChecked: 1,
                totalErrors: errors.length
            }
        };
    }

    /**
     * Check all files that have changed according to git
     */
    checkChangedFiles(): CheckResult {
        const startTime = Date.now();
        let changedFiles: string[] = [];

        try {
            const gitStatus = execSync('git status --porcelain', { cwd: this.projectRoot }).toString();
            changedFiles = gitStatus
                .split('\n')
                .filter(line => line.length > 0)
                .map(line => line.substring(3).trim())
                .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
                .map(file => path.join(this.projectRoot, file));
        } catch (error) {
            throw new Error('Not a git repository or git command failed');
        }

        let allErrors: TypeScriptError[] = [];
        let checkedFileCount = 0;

        for (const file of changedFiles) {
            if (fs.existsSync(file)) {
                try {
                    const result = this.checkFile(file);
                    allErrors = allErrors.concat(result.errors);
                    checkedFileCount++;
                } catch (error: any) {
                    // Skip files that aren't in the TypeScript project (like build files)
                    if (!error.message.includes('Could not find source file')) {
                        throw error;
                    }
                }
            }
        }

        const checkTime = Date.now() - startTime;

        return {
            errors: allErrors,
            metrics: {
                checkTime,
                filesChecked: checkedFileCount,
                totalErrors: allErrors.length
            }
        };
    }

    /**
     * Check all files in the project
     */
    checkAll(): CheckResult {
        const startTime = Date.now();
        const program = this.service.getProgram()!;
        const allDiagnostics = ts.getPreEmitDiagnostics(program);

        const errors: TypeScriptError[] = allDiagnostics
            .filter(d => d.category === ts.DiagnosticCategory.Error || d.category === ts.DiagnosticCategory.Warning)
            .map(diagnostic => this.formatDiagnostic(diagnostic))
            .filter((e): e is TypeScriptError => e !== null);

        const checkTime = Date.now() - startTime;

        // Count only user source files, not library files
        const userSourceFiles = program.getSourceFiles().filter(file =>
            !file.fileName.includes('node_modules') &&
            !file.fileName.includes('lib.') &&
            !file.isDeclarationFile &&
            file.fileName.startsWith(this.projectRoot)
        );

        return {
            errors,
            metrics: {
                checkTime,
                filesChecked: userSourceFiles.length,
                totalErrors: errors.length
            }
        };
    }

    /**
     * Start watch mode for continuous checking
     */
    watch(onDiagnostic: (result: CheckResult) => void, onStatusChange?: (diagnostic: ts.Diagnostic) => void): void {
        const watchHost = ts.createWatchCompilerHost(
            this.configPath,
            {},
            ts.sys,
            ts.createSemanticDiagnosticsBuilderProgram,
            (diagnostic) => {
                if (diagnostic.file) {
                    const error = this.formatDiagnostic(diagnostic);
                    if (error) {
                        onDiagnostic({ errors: [error] });
                    }
                }
            },
            onStatusChange || (() => { })
        );

        ts.createWatchProgram(watchHost);
    }

    private createLanguageServiceHost(): ts.LanguageServiceHost {
        return {
            getScriptFileNames: () => {
                const parsedConfig = ts.parseJsonConfigFileContent(
                    ts.readConfigFile(this.configPath, ts.sys.readFile).config,
                    ts.sys,
                    this.projectRoot
                );
                return parsedConfig.fileNames;
            },
            getScriptVersion: (fileName: string) => {
                const file = this.files.get(fileName);
                return file ? file.version.toString() : '0';
            },
            getScriptSnapshot: (fileName: string) => {
                if (!fs.existsSync(fileName)) {
                    return undefined;
                }

                let file = this.files.get(fileName);
                if (!file) {
                    const content = ts.sys.readFile(fileName);
                    if (content) {
                        file = {
                            version: 0,
                            snapshot: ts.ScriptSnapshot.fromString(content)
                        };
                        this.files.set(fileName, file);
                    }
                }
                return file?.snapshot;
            },
            getCurrentDirectory: () => this.projectRoot,
            getCompilationSettings: () => this.compilerOptions,
            getDefaultLibFileName: (options: ts.CompilerOptions) => ts.getDefaultLibFilePath(options),
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            readDirectory: ts.sys.readDirectory,
            directoryExists: ts.sys.directoryExists,
            getDirectories: ts.sys.getDirectories,
        };
    }

    private updateFile(fileName: string): void {
        const content = ts.sys.readFile(fileName);
        if (content) {
            const file = this.files.get(fileName);
            if (file) {
                file.version++;
                file.snapshot = ts.ScriptSnapshot.fromString(content);
            } else {
                this.files.set(fileName, {
                    version: 0,
                    snapshot: ts.ScriptSnapshot.fromString(content)
                });
            }
        }
    }

    private formatDiagnostic(diagnostic: ts.Diagnostic): TypeScriptError | null {
        if (!diagnostic.file) {
            return null;
        }

        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);

        return {
            file: path.relative(this.projectRoot, diagnostic.file.fileName),
            line: line + 1,
            column: character + 1,
            code: `TS${diagnostic.code}`,
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            severity: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning'
        };
    }
}
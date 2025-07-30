#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface GeneratorOptions {
    size: 'small' | 'medium' | 'large' | 'stress';
    outputDir: string;
    complexity: 'simple' | 'moderate' | 'complex';
    errorRate: number; // 0-1, percentage of files with errors
}

class TestProjectGenerator {
    private fileCount: Map<string, number> = new Map([
        ['small', 10],
        ['medium', 100],
        ['large', 1000],
        ['stress', 5000]
    ]);

    generate(options: GeneratorOptions) {
        const { size, outputDir, complexity, errorRate } = options;
        const numFiles = this.fileCount.get(size) || 10;

        console.log(`📁 Generating ${size} test project with ${numFiles} files...`);
        console.log(`   Complexity: ${complexity}`);
        console.log(`   Error rate: ${(errorRate * 100).toFixed(0)}%`);
        console.log(`   Output: ${outputDir}`);

        // Create output directory
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true });
        }
        fs.mkdirSync(outputDir, { recursive: true });

        // Generate tsconfig.json
        this.generateTsConfig(outputDir);

        // Generate files
        const modules: string[] = [];
        for (let i = 0; i < numFiles; i++) {
            const fileName = `module${i}.ts`;
            const filePath = path.join(outputDir, fileName);
            const hasError = Math.random() < errorRate;
            
            const content = this.generateFileContent(i, complexity, hasError, modules);
            fs.writeFileSync(filePath, content);
            modules.push(`module${i}`);

            if ((i + 1) % 100 === 0) {
                console.log(`   Generated ${i + 1} files...`);
            }
        }

        // Generate index file that imports everything
        const indexContent = modules.map(m => `import './${m}';`).join('\n');
        fs.writeFileSync(path.join(outputDir, 'index.ts'), indexContent);

        console.log(`✅ Generated ${numFiles} TypeScript files in ${outputDir}`);
    }

    private generateTsConfig(outputDir: string) {
        const config = {
            compilerOptions: {
                target: "es2020",
                module: "commonjs",
                lib: ["es2020"],
                outDir: "./dist",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                incremental: true
            },
            include: ["**/*.ts"],
            exclude: ["node_modules", "dist"]
        };

        fs.writeFileSync(
            path.join(outputDir, 'tsconfig.json'),
            JSON.stringify(config, null, 2)
        );
    }

    private generateFileContent(
        index: number, 
        complexity: string, 
        hasError: boolean,
        existingModules: string[]
    ): string {
        let content = `// Module ${index}\n\n`;

        // Add imports based on complexity
        if (complexity !== 'simple' && existingModules.length > 0) {
            const numImports = complexity === 'complex' ? 
                Math.min(5, existingModules.length) : 
                Math.min(2, existingModules.length);
            
            for (let i = 0; i < numImports; i++) {
                const randomModule = existingModules[Math.floor(Math.random() * existingModules.length)];
                content += `import { someFunction${randomModule.replace('module', '')} } from './${randomModule}';\n`;
            }
            content += '\n';
        }

        // Generate interfaces
        if (complexity !== 'simple') {
            content += this.generateInterface(index);
        }

        // Generate functions
        content += this.generateFunction(index, hasError);

        // Generate class if complex
        if (complexity === 'complex') {
            content += this.generateClass(index, hasError);
        }

        // Add exports
        content += `\nexport { someFunction${index} };\n`;

        return content;
    }

    private generateInterface(index: number): string {
        return `
interface Data${index} {
    id: number;
    name: string;
    value: number;
    metadata?: {
        createdAt: Date;
        updatedAt: Date;
    };
}

`;
    }

    private generateFunction(index: number, hasError: boolean): string {
        const errorLine = hasError ? 
            `    const error: number = "this is a type error"; // Type error\n` : '';
        
        return `
export function someFunction${index}(data: Data${index} | any): number {
    ${errorLine}
    const result = data.value * 2;
    
    if (data.metadata) {
        console.log(\`Processing data from \${data.metadata.createdAt}\`);
    }
    
    return result + ${index};
}

`;
    }

    private generateClass(index: number, hasError: boolean): string {
        const errorLine = hasError ? 
            `        this.incorrectType = "should be number"; // Type error\n` : '';
        
        return `
class DataProcessor${index} {
    private data: Data${index}[] = [];
    ${hasError ? 'private incorrectType: number;\n' : ''}
    
    constructor() {
        ${errorLine}
    }
    
    add(item: Data${index}): void {
        this.data.push(item);
    }
    
    process(): number {
        return this.data.reduce((sum, item) => sum + someFunction${index}(item), 0);
    }
}

export { DataProcessor${index} };
`;
    }
}

// CLI interface
const args = process.argv.slice(2);
const options: GeneratorOptions = {
    size: 'medium',
    outputDir: './test-project',
    complexity: 'moderate',
    errorRate: 0.1
};

// Parse arguments
for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
        case '--size':
            options.size = value as any;
            break;
        case '--output':
            options.outputDir = value;
            break;
        case '--complexity':
            options.complexity = value as any;
            break;
        case '--error-rate':
            options.errorRate = parseFloat(value);
            break;
    }
}

if (args.includes('--help')) {
    console.log(`
Test Project Generator for ts-fast-check

Usage: node test/generate-test-project.js [options]

Options:
  --size         Project size: small (10), medium (100), large (1000), stress (5000)
  --output       Output directory (default: ./test-project)
  --complexity   Code complexity: simple, moderate, complex
  --error-rate   Percentage of files with errors (0-1, default: 0.1)
  
Examples:
  node test/generate-test-project.js --size large --error-rate 0.2
  node test/generate-test-project.js --size stress --complexity complex
`);
    process.exit(0);
}

const generator = new TestProjectGenerator();
generator.generate(options);
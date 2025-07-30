#!/usr/bin/env node

/**
 * Test script simulating an agentic workflow where an AI agent
 * modifies multiple files and needs to check TypeScript errors
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

// Simulate agent creating/modifying multiple files
function simulateAgentChanges() {
    console.log('🤖 AI Agent: Making changes to multiple files...\n');

    // Create a new types file
    fs.writeFileSync('types.ts', `
export interface User {
    id: number;
    name: string;
    email: string;
}

export interface Product {
    id: number;
    title: string;
    price: number;
    userId: number; // Reference to User
}
`);

    // Create a service file that uses the types
    fs.writeFileSync('service.ts', `
import { User, Product } from './types';

export class UserService {
    private users: User[] = [];
    
    addUser(user: User): void {
        this.users.push(user);
    }
    
    // Error: wrong return type
    getUser(id: number): Product {
        return this.users.find(u => u.id === id);
    }
}

export class ProductService {
    private products: Product[] = [];
    
    addProduct(product: Product): void {
        this.products.push(product);
    }
    
    // Error: parameter name mismatch
    getUserProducts(userId: string): Product[] {
        return this.products.filter(p => p.userId === userId);
    }
}
`);

    // Modify an existing file to use the new types
    fs.writeFileSync('app.ts', `
import { UserService, ProductService } from './service';
import { User } from './types';

const userService = new UserService();
const productService = new ProductService();

// Error: missing required property
const user: User = {
    id: 1,
    name: "John Doe"
    // Missing email property
};

userService.addUser(user);

// Error: wrong argument type  
const products = productService.getUserProducts(123);
console.log(products);
`);

    console.log('✅ Created: types.ts, service.ts, app.ts');
}

const benchmarkApproaches = () => {
    console.log('\n📊 Benchmarking different approaches:\n');

    // Approach 1: Check individual files
    console.log('1️⃣ Individual file checks:');
    const start1 = performance.now();

    const files = ['types.ts', 'service.ts', 'app.ts'];
    files.forEach(file => {
        try {
            execSync(`node dist/index.js check ${file} --quiet`, { stdio: 'pipe' });
        } catch (error) {
            // Errors expected
        }
    });

    const time1 = performance.now() - start1;
    console.log(`   Time: ${time1.toFixed(0)}ms for ${files.length} individual checks`);

    // Approach 2: Check changed files (batch)
    console.log('\n2️⃣ Check changed files (batch):');
    const start2 = performance.now();

    let result2;
    try {
        result2 = execSync('node dist/index.js check-changed --output json --metrics', {
            encoding: 'utf8',
            stdio: 'pipe'
        });
    } catch (error: any) {
        result2 = error.stdout;
    }

    const time2 = performance.now() - start2;
    const data2 = JSON.parse(result2);

    console.log(`   Time: ${time2.toFixed(0)}ms for ${data2.metrics.filesChecked} files`);
    console.log(`   Errors found: ${data2.errors.length}`);

    // Approach 3: Full project check
    console.log('\n3️⃣ Full project check:');
    const start3 = performance.now();

    let result3;
    try {
        result3 = execSync('node dist/index.js check-all --output json --metrics', {
            encoding: 'utf8',
            stdio: 'pipe'
        });
    } catch (error: any) {
        result3 = error.stdout;
    }

    const time3 = performance.now() - start3;
    const data3 = JSON.parse(result3);

    console.log(`   Time: ${time3.toFixed(0)}ms for ${data3.metrics.filesChecked} files`);
    console.log(`   Errors found: ${data3.errors.length}`);

    // Show comparison
    console.log('\n📈 Comparison:');
    console.log(`Individual checks: ${time1.toFixed(0)}ms`);
    console.log(`Batch check-changed: ${time2.toFixed(0)}ms (${(time1 / time2).toFixed(2)}x slower than batch)`);
    console.log(`Full project: ${time3.toFixed(0)}ms`);

    // Show sample errors for context
    console.log('\n🔍 Sample errors found:');
    data2.errors.slice(0, 3).forEach((error: any, i: number) => {
        console.log(`${i + 1}. ${error.file}:${error.line} - ${error.message}`);
    });

    return { individualTime: time1, batchTime: time2, fullTime: time3, errorCount: data2.errors.length };
}

const cleanup = () => {
    console.log('\n🧹 Cleaning up test files...');
    ['types.ts', 'service.ts', 'app.ts'].forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    });
}

const main = () => {
    console.log('🧪 AGENTIC WORKFLOW PERFORMANCE TEST');
    console.log('Testing AI agent that modifies multiple TypeScript files\n');

    try {
        simulateAgentChanges();
        const results = benchmarkApproaches();

        console.log('\n🎯 CONCLUSION:');
        console.log(`For AI agents modifying multiple files:`);
        console.log(`- check-changed is ${(results.individualTime / results.batchTime).toFixed(2)}x faster than individual checks`);
        console.log(`- Found ${results.errorCount} cross-file type errors`);
        console.log(`- Batch checking gives complete context of related errors`);

        if (results.batchTime < results.individualTime) {
            console.log('\n✅ RECOMMENDATION: Use check-changed for multi-file agent workflows');
        }

    } finally {
        cleanup();
    }
};

main();
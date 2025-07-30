#!/usr/bin/env node

/**
 * CLI Entry point for ts-fast-check
 */

import { CLI } from './src/cli.js';

const cli = new CLI();
cli.run().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(2);
});
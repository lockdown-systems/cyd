#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Get command line arguments (excluding node and script name)
const args = process.argv.slice(2);

// Default test pattern if no arguments provided
const testPattern = args.length > 0 ? args.join(' ') : 'src';

// Build the command
const vitestArgs = ['run', '--coverage'];
if (args.length > 0) {
  vitestArgs.push(...args);
} else {
  vitestArgs.push('src');
}

console.log(`Running tests with pattern: ${testPattern}`);

// Run pnpm rebuild first
const rebuild = spawn('pnpm', ['rebuild'], { stdio: 'inherit', shell: true });

rebuild.on('close', (code) => {
  if (code !== 0) {
    console.error('Rebuild failed');
    process.exit(code);
  }

  // Run vitest
  const vitest = spawn('vitest', vitestArgs, { stdio: 'inherit', shell: true });

  vitest.on('close', (code) => {
    // Run cleanup script
    const cleanup = spawn('node', ['./scripts/clean.mjs'], { stdio: 'inherit', shell: true });
    
    cleanup.on('close', (cleanupCode) => {
      // Exit with vitest's exit code, not cleanup's
      process.exit(code);
    });
  });
});

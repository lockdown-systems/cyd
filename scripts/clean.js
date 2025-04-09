import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const directoriesToRemove = ['./out', './node_modules'];

directoriesToRemove.forEach((dir) => {
    const fullPath = path.resolve(dir);
    if (fs.existsSync(fullPath)) {
        console.log(`Deleting: ${fullPath}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
    }
});

// Delete all files in the build directory except config.json
const buildDir = path.resolve('./build');
if (fs.existsSync(buildDir)) {
    console.log(`Cleaning: ${buildDir}`);
    fs.readdirSync(buildDir).forEach((file) => {
        const filePath = path.join(buildDir, file);
        if (file !== 'config.json') {
            console.log(`Deleting: ${filePath}`);
            fs.rmSync(filePath, { recursive: true, force: true });
        }
    });
}

console.log('Running npm install...');
execSync('npm install', { stdio: 'inherit' });

if (os.platform() === 'linux') {
    const chromeSandboxPath = path.resolve('node_modules/electron/dist/chrome-sandbox');
    if (fs.existsSync(chromeSandboxPath)) {
        console.log('Adjusting permissions for chrome-sandbox...');
        execSync(`sudo chown root:root ${chromeSandboxPath}`);
        execSync(`sudo chmod 4755 ${chromeSandboxPath}`);
    }
}

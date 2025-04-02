import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const directoriesToRemove = ['./out', './build', './node_modules'];

directoriesToRemove.forEach((dir) => {
    const fullPath = path.resolve(dir);
    if (fs.existsSync(fullPath)) {
        console.log(`Removing: ${fullPath}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
    }
});

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

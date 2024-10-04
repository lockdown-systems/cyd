#!/bin/bash
rm -rf ./out/ ./build/ ./node_modules/
npm install

# Check if it's linux
if [ "$(uname)" == "Linux" ]; then
    sudo chown root:root node_modules/electron/dist/chrome-sandbox
    sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
fi

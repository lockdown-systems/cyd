#!/bin/sh
rm -rf node_modules
npm install

if [ "$(uname)" == "Linux" ]; then
    sudo chown root:root node_modules/electron/dist/chrome-sandbox
    sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
fi
#!/bin/bash

# Change to the directory of the script
cd "$(dirname "$0")"

# Build the archive static site
echo "👉 Building X archive static site..."
cd x-archive
rm -r dist || true
npm install
npm run build

# Zip it up
cd dist
mkdir -p ../../../build/
zip -r ../../../build/x-archive.zip .
cd ../..

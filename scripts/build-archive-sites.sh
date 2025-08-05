#!/bin/bash

# Change to the root directory of the project
cd "$(dirname "$0")/.."

build_archive_site() {
    site=$1
    echo ">> Building ${site} archive static site..."
    rm -f archive-static-sites/${site}-archive/public/assets/archive.js
    rm -r archive-static-sites/${site}-archive/dist || true
    pnpm --filter ${site}-archive build

    # Zip it up
    cd archive-static-sites/${site}-archive/dist
    mkdir -p ../../../build/
    rm -f ../../../build/${site}-archive.zip
    zip -r ../../../build/${site}-archive.zip .
    cd ../../..
}

# Build each site
build_archive_site x
build_archive_site facebook

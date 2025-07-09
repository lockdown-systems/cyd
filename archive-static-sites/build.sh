#!/bin/bash

# Change to the directory of the script
cd "$(dirname "$0")"

build_archive_site() {
    site=$1
    echo ">> Building ${site} archive static site..."
    rm -f ${site}-archive/public/assets/archive.js
    cd ${site}-archive
    rm -r dist || true
    pnpm --filter ${site}-archive install
    pnpm --filter ${site}-archive build

    # Zip it up
    cd dist
    mkdir -p ../../../build/
    rm -f ../../../build/${site}-archive.zip
    zip -r ../../../build/${site}-archive.zip .
    cd ../..
}

# Build each site
build_archive_site x
build_archive_site facebook

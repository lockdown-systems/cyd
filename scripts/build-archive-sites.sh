#!/bin/bash

# Change to the root directory of the project
cd "$(dirname "$0")/.."

build_archive_site() {
    site=$1
    echo ">> Building ${site} archive static site..."
    rm -r archive-static-sites/${site}-archive/dist || true
    npm run build --workspace=archive-static-sites/${site}-archive

    # Zip it up
    cd archive-static-sites/${site}-archive/dist
    mkdir -p ../../../build/
    rm -f ../../../build/${site}-archive.zip
    zip -r ../../../build/${site}-archive.zip .
    cd ../../..
}

# Build each site
build_archive_site x

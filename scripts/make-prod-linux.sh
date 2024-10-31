#!/bin/sh
export CYD_ENV=prod
export DEBUG=electron-packager,electron-universal,electron-forge*

./scripts/clean.sh
electron-forge make

#!/bin/sh
export CYD_ENV=dev
export DEBUG=electron-packager,electron-universal,electron-forge*

./scripts/clean.sh
electron-forge publish --arch universal
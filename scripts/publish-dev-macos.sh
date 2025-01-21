#!/bin/sh
export CYD_ENV=dev
export DEBUG=electron-packager,electron-universal,electron-forge*,electron-installer*
export MACOS_RELEASE=true

./scripts/clean.sh
electron-forge publish --arch universal
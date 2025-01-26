#!/bin/sh
export CYD_ENV=prod
export DEBUG=electron-packager,electron-universal,electron-forge*,electron-installer*
export MACOS_RELEASE=true

./scripts/clean.sh
electron-forge publish --arch universal
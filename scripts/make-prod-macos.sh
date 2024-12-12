#!/bin/sh
export CYD_ENV=prod
export DEBUG=electron-packager,electron-universal,electron-forge*,electron-installer*

./scripts/clean.sh
electron-forge make --arch universal
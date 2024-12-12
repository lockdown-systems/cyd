#!/bin/sh
export CYD_ENV=dev
export DEBUG=electron-packager,electron-universal,electron-forge*,electron-installer*

./scripts/clean.sh
electron-forge make

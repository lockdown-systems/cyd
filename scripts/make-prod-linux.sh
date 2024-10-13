#!/bin/sh
export SEMIPHEMERAL_ENV=prod
export DEBUG=electron-packager,electron-universal,electron-forge*

./scripts/clean.sh
electron-forge make --arch=x64,arm64
#!/bin/sh
export SEMIPHEMERAL_ENV=dev
export DEBUG=electron-packager,electron-universal,electron-forge*,electron-installer-snap*

./scripts/clean.sh
electron-forge make

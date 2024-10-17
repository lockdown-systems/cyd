#!/bin/sh
export SEMIPHEMERAL_ENV=prod
export DEBUG=electron-packager,electron-universal,electron-forge*,electron-installer-snap*

./scripts/clean.sh
electron-forge make

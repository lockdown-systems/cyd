#!/bin/sh
export SEMIPHEMERAL_ENV=local
export DEBUG=electron-packager,electron-universal,electron-forge*

./scripts/clean.sh
electron-forge make
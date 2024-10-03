#!/bin/sh
export SEMIPHEMERAL_ENV=local
export DEBUG=electron-packager,electron-universal,electron-forge*

./scripts/clean.sh
npx tsx ./node_modules/.bin/electron-forge make
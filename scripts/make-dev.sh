#!/bin/sh
export SEMIPHEMERAL_ENV=dev
export DEBUG=electron-packager,electron-universal,electron-forge*
rm -rf ./out/
npx tsx ./node_modules/.bin/electron-forge make
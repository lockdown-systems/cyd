#!/bin/sh
export SEMIPHEMERAL_ENV=prod
export DEBUG=electron-packager,electron-universal,electron-forge*
rm -rf ./out/
npx tsx ./node_modules/.bin/electron-forge make --arch universal
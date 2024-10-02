#!/bin/sh
export SEMIPHEMERAL_ENV=local
export DEBUG=electron-packager,electron-universal,electron-forge*
npx tsx ./node_modules/.bin/electron-forge make
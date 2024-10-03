#!/bin/sh
export SEMIPHEMERAL_ENV=prod
export DEBUG=electron-packager,electron-universal,electron-forge*
rm -rf ./out/
electron-forge make --arch universal
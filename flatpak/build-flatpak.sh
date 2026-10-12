#!/bin/sh
set -e
cd "$(dirname "$0")/.."
npm install
CYD_ENV=prod npx electron-forge package
cd flatpak
flatpak-builder --user --install --force-clean build-dir social.cyd.Cyd.yml

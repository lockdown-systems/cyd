#!/usr/bin/env pwsh
$env:SEMIPHEMERAL_ENV = "dev"
$env:DEBUG = "electron-packager,electron-universal,electron-forge*"
electron-forge make
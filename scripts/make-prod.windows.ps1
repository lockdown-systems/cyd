#!/usr/bin/env pwsh
$env:SEMIPHEMERAL_ENV = "prod"
$env:DEBUG = "electron-packager,electron-universal,electron-forge*"
electron-forge make
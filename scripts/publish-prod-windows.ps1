#!/usr/bin/env pwsh
$env:CYD_ENV = "prod"
$env:DEBUG = "electron-packager,electron-universal,electron-forge*,electron-installer*"
$env:WINDOWS_RELEASE = "true"

# https://github.com/Squirrel/Squirrel.Windows/issues/1838#issuecomment-1514089628
$env:SQUIRREL_TEMP = "build\SquirrelTemp"

powershell -ExecutionPolicy Bypass -File .\scripts\clean.ps1
electron-forge publish
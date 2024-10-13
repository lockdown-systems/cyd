#!/usr/bin/env pwsh
$env:SEMIPHEMERAL_ENV = "dev"
$env:DEBUG = "electron-packager,electron-universal,electron-forge*"
$env:WINDOWS_SIGN = "true"

# https://github.com/Squirrel/Squirrel.Windows/issues/1838#issuecomment-1514089628
$env:SQUIRREL_TEMP = "build\SquirrelTemp"

powershell -ExecutionPolicy Bypass -File .\scripts\clean.ps1
electron-forge publish
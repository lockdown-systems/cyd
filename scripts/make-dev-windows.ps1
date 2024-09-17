#!/usr/bin/env pwsh
$env:SEMIPHEMERAL_ENV = "dev"
$env:DEBUG = "electron-packager,electron-universal,electron-forge*"

# https://github.com/Squirrel/Squirrel.Windows/issues/1838#issuecomment-1514089628
$env:SQUIRREL_TEMP = "build\SquirrelTemp"

electron-forge make
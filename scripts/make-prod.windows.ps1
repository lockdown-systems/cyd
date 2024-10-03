#!/usr/bin/env pwsh
$env:SEMIPHEMERAL_ENV = "prod"
$env:DEBUG = "electron-packager,electron-universal,electron-forge*"

# https://github.com/Squirrel/Squirrel.Windows/issues/1838#issuecomment-1514089628
$env:SQUIRREL_TEMP = "build\SquirrelTemp"

if (Test-Path -Path "out") {
    Remove-Item -Path "out" -Recurse -Force
}
npx tsx ./node_modules/@electron-forge/cli/dist/electron-forge.js make
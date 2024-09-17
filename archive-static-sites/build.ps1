#!/usr/bin/env pwsh

# Change to the directory of the script
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition)

# Build the archive static site
Write-Output ">> Building X archive static site..."
Set-Location -Path "x-archive"
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
npm install
npm run build

# Zip it up
Set-Location -Path "dist"
Compress-Archive -Path * -DestinationPath "../../../build/x-archive.zip" -Force
Set-Location -Path "../.."
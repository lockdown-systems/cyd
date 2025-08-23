#!/usr/bin/env pwsh

# Change to the directory of the script
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition)

# Build the archive static site
Write-Output ">> Building X archive static site..."
Set-Location -Path "../archive-static-sites/x-archive"
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
npm install --workspace=archive-static-sites/x-archive
npm run build --workspace=archive-static-sites/x-archive

# Zip it up
Set-Location -Path "dist"
Compress-Archive -Path * -DestinationPath "../../../build/x-archive.zip" -Force
Set-Location -Path "../.."

# Build the Facebook archive static site
Write-Output ">> Building Facebook archive static site..."
Set-Location -Path "facebook-archive"
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
npm install --workspace=archive-static-sites/facebook-archive
npm run build --workspace=archive-static-sites/facebook-archive

# Zip it up
Set-Location -Path "dist"
Compress-Archive -Path * -DestinationPath "../../../build/facebook-archive.zip" -Force
Set-Location -Path "../.."

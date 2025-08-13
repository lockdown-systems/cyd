#!/usr/bin/env pwsh

# Change to the directory of the script
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition)

# Build the archive static site
Write-Output ">> Building X archive static site..."
Set-Location -Path "../archive-static-sites/x-archive"
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
pnpm --filter x-archive install
pnpm --filter x-archive build

# Zip it up
Set-Location -Path "dist"
Compress-Archive -Path * -DestinationPath "../../../build/x-archive.zip" -Force
Set-Location -Path "../.."

# Build the Facebook archive static site
Write-Output ">> Building Facebook archive static site..."
Set-Location -Path "facebook-archive"
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
pnpm --filter facebook-archive install
pnpm --filter facebook-archive build

# Zip it up
Set-Location -Path "dist"
Compress-Archive -Path * -DestinationPath "../../../build/facebook-archive.zip" -Force
Set-Location -Path "../.."

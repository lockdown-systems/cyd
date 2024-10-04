#!/usr/bin/env pwsh
if (Test-Path -Path "out") {
    Remove-Item -Path "out" -Recurse -Force
}

if (Test-Path -Path "build") {
    Remove-Item -Path "build" -Recurse -Force
}

if (Test-Path -Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force
}

npm install
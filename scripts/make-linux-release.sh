#!/bin/bash
CYD_VERSION=$(cat package.json | grep '"version"' | cut -d'"' -f4)
if [[ "$CYD_VERSION" == *-dev ]]; then
    npm run make-dev
else
    npm run make-prod
fi 

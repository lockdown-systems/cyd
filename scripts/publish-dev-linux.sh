#!/bin/bash

# Cleanup from last time
rm -r ./out-arm64
rm -r ./out-amd64

# Build release for arm64
docker build --platform linux/arm64 -f Dockerfile-linux-release -t cyd-linux-release .
docker run --platform linux/arm64 --rm -v $(pwd):/app cyd-linux-release npm run make-dev-linux
mv ./out/ ./out-arm64

# Build release for amd64
docker build --platform linux/amd64 -f Dockerfile-linux-release -t cyd-linux-release .
docker run --platform linux/amd64 --rm -v $(pwd):/app cyd-linux-release npm run make-dev-linux
mv ./out/ ./out-amd64

# Copy binaries to linux-repos
echo ""
echo "======================================="
echo "Copy binaries to linux-repos like this:"
echo "======================================="
echo cd ../linux-repos/
echo ./copy-binaries.sh dev
echo docker compose --env-file .env-dev up --build

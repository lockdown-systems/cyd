#!/bin/bash

# Cleanup from last time
sudo rm -rf ./out-arm64
sudo rm -rf ./out-amd64

# Build release for amd64
npm run make-prod-linux
mv ./out/ ./out-amd64

# Build release for arm64
docker build --platform linux/arm64 -f Dockerfile-linux-release -t cyd-linux-release .
docker run --platform linux/arm64 --rm -v $(pwd):/app cyd-linux-release npm run make-prod-linux
mv ./out/ ./out-arm64

sudo chown -R $USER:$USER .

# Copy binaries to linux-repos
echo ""
echo "======================================="
echo "Copy binaries to linux-repos like this:"
echo "======================================="
echo cd ../linux-repos/
echo ./scripts/release-prod.sh

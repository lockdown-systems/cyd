#!/bin/bash

# Build release for arm64
docker build --platform linux/arm64 -f Dockerfile-linux-release -t cyd-linux-release .
docker run --platform linux/arm64 --rm -v $(pwd):/app cyd-linux-release npm run make-prod-linux

# Build release for amd64
docker build --platform linux/amd64 -f Dockerfile-linux-release -t cyd-linux-release .
docker run --platform linux/amd64 --rm -v $(pwd):/app cyd-linux-release npm run make-prod-linux

# Copy binaries to linux-repos
echo ""
echo "======================================="
echo "Copy binaries to linux-repos like this:"
echo "======================================="
echo cd ../linux-repos/
echo ./scripts/release-prod.sh

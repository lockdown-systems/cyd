#!/bin/bash

# Build release for arm64
docker build --platform linux/arm64 -f Dockerfile-linux-release -t semiphemeral-linux-release .
docker run --platform linux/arm64 --rm -v $(pwd):/app semiphemeral-linux-release npm run make-prod-linux

# Build release for amd64
docker build --platform linux/amd64 -f Dockerfile-linux-release -t semiphemeral-linux-release .
docker run --platform linux/amd64 --rm -v $(pwd):/app semiphemeral-linux-release npm run make-prod-linux

# Copy binaries to linux-repos
echo ""
echo "======================================="
echo "Copy binaries to linux-repos like this:"
echo "======================================="
echo cd ../linux-repos/
echo ./copy-binaries.sh prod
echo docker compose --env-file .env-prod up --build

#!/bin/bash

# Build release for arm64
docker build -f Dockerfile-linux-release --platform linux/arm64 -t semiphemeral-linux-release .
docker run --platform linux/arm64 -v $(pwd):/app semiphemeral-linux-release npm run make-dev-linux

# Build release for amd64
docker build -f Dockerfile-linux-release --platform linux/amd64 -t semiphemeral-linux-release .
docker run --platform linux/amd64 -v $(pwd):/app semiphemeral-linux-release npm run make-dev-linux

# Copy binaries to linux-repos
echo "Copying binaries to linux-repos like this:"
echo "---"
echo cd ../linux-repos/
echo ./copy-binaries.sh dev
echo docker compose --env-file .env-dev up --build

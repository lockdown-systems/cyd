#!/bin/bash

# Build release for arm64
docker build --platform linux/arm64 -f Dockerfile-linux-release -t semiphemeral-linux-release .
docker run --platform linux/arm64 --rm -v $(pwd):/app semiphemeral-linux-release npm run make-dev-linux
cp -r out/ ./out-arm64

# Build release for amd64
docker build --platform linux/amd64 -f Dockerfile-linux-release -t semiphemeral-linux-release .
docker run --platform linux/amd64 --rm -v $(pwd):/app semiphemeral-linux-release npm run make-dev-linux
cp -r out/ ./out-amd64

# Merge the two builds
rm -rf out/
mkdir -p out/make/deb out/make/rpm
mv out-arm64/make/deb/* out/make/deb
mv out-arm64/make/rpm/* out/make/rpm
mv out-amd64/make/deb/* out/make/deb
mv out-amd64/make/rpm/* out/make/rpm
rm -rf out-arm64 out-amd64

# Copy binaries to linux-repos
echo ""
echo "======================================="
echo "Copy binaries to linux-repos like this:"
echo "======================================="
echo cd ../linux-repos/
echo ./copy-binaries.sh dev
echo docker compose --env-file .env-dev up --build

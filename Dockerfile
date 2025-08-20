# For making linux releases

FROM node:22-bookworm

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y \
    build-essential \
    fakeroot \
    curl \
    rpm \
    zip \
    sudo

# Install pnpm
RUN npm install -g pnpm

WORKDIR /workspace


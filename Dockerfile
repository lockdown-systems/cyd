# For making linux releases

FROM node:20-bookworm

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y \
    build-essential \
    fakeroot \
    curl \
    rpm \
    zip \
    sudo

WORKDIR /workspace


# For making linux releases

# Node 24 is the current LTS. Bookworm is deliberate, not incidental: the
# postinstall rebuilds better-sqlite3 from source against this image's glibc,
# so the base image sets the floor for every Linux user. Bookworm is 2.36;
# trixie would raise it to 2.41.
FROM node:24-bookworm

# Match the npm developers run. npm from 12 refuses install scripts it has not
# been told to trust, so building here exercises the allowScripts allowlist in
# package.json rather than leaving it to break on someone's laptop.
RUN npm install -g npm@12.0.2

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y \
    build-essential \
    fakeroot \
    curl \
    rpm \
    zip \
    sudo

WORKDIR /workspace

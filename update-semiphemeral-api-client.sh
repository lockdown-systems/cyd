#!/bin/sh

# Sync the semiphemeral-api-client
rsync -av --delete ../semiphemeral-api-client/ ./src/renderer/src/semiphemeral-api-client/
cd ./src/renderer/src/semiphemeral-api-client
rm -rf .git
cd ../../../..

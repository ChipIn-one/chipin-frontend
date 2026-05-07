#!/usr/bin/env bash

set -e

# get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# common parts
HASH=$(git rev-parse --short HEAD)
BASE_VERSION=$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")

if [ "$BRANCH" = "main" ]; then
  # production build: pure release version from package.json
  VERSION="${BASE_VERSION}"
else
  # non-main build: release version + build metadata
  VERSION="${BASE_VERSION}-dev-${HASH}"
fi

# write to file
echo "export const APP_VERSION = '${VERSION}';" > src/constants/version.ts

echo "Version generated: $VERSION"
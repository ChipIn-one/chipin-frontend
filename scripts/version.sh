#!/usr/bin/env bash

set -e

# get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# common parts
HASH=$(git rev-parse --short HEAD)

if [ "$BRANCH" = "main" ]; then
  # try to get tag-based version
  if git describe --tags --abbrev=0 >/dev/null 2>&1; then
    VERSION=$(git describe --tags --always)
  else
    VERSION="${HASH}"
  fi
else
  # dev branch (and everything else)
  VERSION="dev-${HASH}"
fi

# write to file
echo "export const APP_VERSION = '${VERSION}';" > src/constants/version.ts

echo "Version generated: $VERSION"
#!/bin/bash

# Create Package Script
# Usage: ./scripts/create-package.sh <package-name>

if [ $# -eq 0 ]; then
    echo "Error: Please provide a package name"
    echo "Usage: ./scripts/create-package.sh <package-name>"
    exit 1
fi

PKG_NAME="$1"

echo "Creating package: $PKG_NAME"

echo "n" | turbo gen workspace --copy @packages/template --type package -n "$PKG_NAME" -d "packages/$PKG_NAME"

echo "✅ Successfully created $PKG_NAME at packages/$PKG_NAME" 
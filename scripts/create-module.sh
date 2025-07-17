#!/bin/bash

# Create Module Script
# Usage: ./scripts/create-module.sh <module-name>

if [ $# -eq 0 ]; then
    echo "Error: Please provide a module name"
    echo "Usage: ./scripts/create-module.sh <module-name>"
    exit 1
fi

MODULE_NAME="$1"

echo "Creating module: $MODULE_NAME"

echo "n" | turbo gen workspace --copy @modules/template --type package -n "$MODULE_NAME" -d "modules/$MODULE_NAME"

echo "✅ Successfully created $MODULE_NAME at modules/$MODULE_NAME" 
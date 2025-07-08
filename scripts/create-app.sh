#!/bin/bash

# Create App Script
# Usage: ./scripts/create-app.sh <app-name>

if [ $# -eq 0 ]; then
    echo "Error: Please provide an app name"
    echo "Usage: ./scripts/create-app.sh <app-name>"
    exit 1
fi

APP_NAME="$1"

echo "Creating app: $APP_NAME"

# Create the app with turbo gen, declining workspace dependencies
echo "n" | turbo gen workspace --copy template --type app -n "$APP_NAME" -d "apps/$APP_NAME"

echo "✅ Successfully created $APP_NAME at apps/$APP_NAME"
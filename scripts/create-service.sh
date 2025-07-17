#!/bin/bash

# Create Service Script
# Usage: ./scripts/create-service.sh <service-name>

if [ $# -eq 0 ]; then
    echo "Error: Please provide a service name"
    echo "Usage: ./scripts/create-service.sh <service-name>"
    exit 1
fi

SERVICE_NAME="$1"

echo "Creating service: $SERVICE_NAME"

echo "n" | turbo gen workspace --copy @services/template --type package -n "$SERVICE_NAME" -d "services/$SERVICE_NAME"

echo "✅ Successfully created $SERVICE_NAME at services/$SERVICE_NAME" 
#!/bin/bash

# Setup script for blockchain data warehouse
# This script helps you configure your environment variables

set -e

echo "🔧 Blockchain Data Warehouse - Environment Setup"
echo "=================================================="

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

# Copy template
echo "📋 Creating .env.local from template..."
cp .env.example .env.local

# Get Vercel Blob token
echo ""
echo "🔑 Vercel Blob Setup"
echo "==================="
echo "You need a BLOB_READ_WRITE_TOKEN from Vercel Blob storage."
echo ""
echo "Get your token from:"
echo "1. https://vercel.com/dashboard → Storage → Blob"
echo "2. Or run: vercel blob create"
echo ""

read -p "Enter your BLOB_READ_WRITE_TOKEN: " -r BLOB_TOKEN

if [ -z "$BLOB_TOKEN" ]; then
    echo "❌ No token provided. You can add it later to .env.local"
else
    # Update the .env.local file with the actual token
    sed -i "s|BLOB_READ_WRITE_TOKEN=your_blob_token_here|BLOB_READ_WRITE_TOKEN=$BLOB_TOKEN|g" .env.local
    echo "✅ Token added to .env.local"
fi

# Optional: Get deployment ID
echo ""
read -p "Enter VERCEL_DEPLOYMENT_ID (optional, press Enter to skip): " -r DEPLOYMENT_ID

if [ -n "$DEPLOYMENT_ID" ]; then
    echo "VERCEL_DEPLOYMENT_ID=$DEPLOYMENT_ID" >> .env.local
    echo "✅ Deployment ID added"
fi

# Export environment variables for current session
echo ""
echo "🚀 Exporting environment variables for current session..."

# Source the .env.local file and export variables
if [ -f ".env.local" ]; then
    set -a  # automatically export all variables
    source .env.local
    set +a  # turn off automatic export
    echo "✅ Environment variables exported"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Install dependencies: pnpm install"
echo "2. Seed sample data: pnpm seed"
echo "3. Start development: pnpm dev"
echo "4. Open http://localhost:3800"
echo ""
echo "Note: The environment variables are exported for this session."
echo "For permanent setup, restart your terminal or run:"
echo "source .env.local"
echo ""

# Test if we can create a simple test
if [ -n "$BLOB_TOKEN" ]; then
    echo "🧪 Testing blob storage connection..."
    echo "Run this after starting the dev server:"
    echo "curl http://localhost:3800/api/test"
fi
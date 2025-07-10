# Vercel Sandbox Demo Scripts

This directory contains demo scripts for Vercel Sandbox functionality.

## Setup

Before running these scripts, you need to authenticate with Vercel:

### Option 1: Vercel CLI Login
```bash
npx vercel login
```

### Option 2: Environment Variable
Set your Vercel token as an environment variable:
```bash
export VERCEL_TOKEN="your_vercel_token_here"
```

To get a Vercel token:
1. Go to https://vercel.com/account/tokens
2. Create a new token
3. Copy the token value

## Running Scripts

```bash
# Hello World demo
pnpm script scripts/sandbox/01-hello-world.ts

# NPM packages demo
pnpm script scripts/sandbox/02-npm-packages.ts

# Python runtime demo
pnpm script scripts/sandbox/03-python-demo.ts
```

## Scripts Description

- **01-hello-world.ts**: Basic Node.js sandbox execution
- **02-npm-packages.ts**: Install and use NPM packages in sandbox
- **03-python-demo.ts**: Python runtime with pip package installation
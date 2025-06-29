# CI/CD Pipeline Documentation

## Overview

This repository uses GitHub Actions for continuous integration and automated security monitoring. The pipeline ensures code quality, runs tests, and provides comprehensive security scanning without interfering with the existing Vercel deployment automation.

## Workflows

### 🔍 CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch

**Jobs:**
- **Code Quality**: Linting and type checking across all packages
- **Testing**: Run test suites using Turbo for optimal performance
- **Build**: Verify all applications build successfully with environment variables

**Features:**
- Caches dependencies and build artifacts using Turbo
- Runs only on changed packages for efficiency
- 15-minute timeout to prevent hanging builds
- Requires all checks to pass before merge

### 🚀 Deployment 

Vercel deployment is already configured and automated through existing integrations. The following apps are automatically deployed:

- `blaze-signer` - Vercel cron: every minute
- `dex-cache` - Vercel cron: every minute (energy data), every 5 minutes (reserves), every 30 minutes (warm prices)
- `meme-roulette` - Vercel deployment
- `simple-swap` - Vercel deployment

### 🔒 Security (`security.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch  
- Weekly schedule (Mondays at 2 AM UTC)

**Scans:**
- **CodeQL**: Static code analysis for security vulnerabilities
- **Dependency Audit**: Check for known vulnerabilities in dependencies using pnpm audit
- **Secret Detection**: Scan for exposed secrets using TruffleHog

### 📦 Dependabot (`dependabot.yml`)

**Schedule:**
- Weekly updates on Mondays at 9 AM UTC
- Separate groups for development and production dependencies
- Automatic GitHub Actions updates
- r0zar assigned as reviewer for all dependency PRs

## Required Secrets

Configure these secrets in your GitHub repository settings for CI builds:

### Application Environment Variables (for CI builds)
- `KV_URL`: Key-value store URL
- `KV_REST_API_URL`: KV REST API endpoint
- `KV_REST_API_TOKEN`: KV API authentication token
- `KV_REST_API_READ_ONLY_TOKEN`: Read-only KV token
- `HIRO_API_KEY`: Hiro Stacks API key
- `NEXT_PUBLIC_TOKEN_CACHE_URL`: Public token cache endpoint

## Branch Protection Rules

Recommended branch protection settings for `main`:

```yaml
Required status checks:
- Test & Lint
- CodeQL Analysis  
- Dependency Vulnerability Scan

Additional settings:
- Require branches to be up to date before merging
- Require linear history
- Include administrators
```

## Local Development

The CI pipeline mirrors your local development workflow:

```bash
# Install dependencies
pnpm install

# Run quality checks (same as CI)
pnpm lint  
pnpm check-types
pnpm test

# Build all apps
pnpm build
```

## Troubleshooting

### CI Failures

1. **Lint errors**: Run `pnpm lint --fix` to auto-fix issues
2. **Type errors**: Check TypeScript configuration and imports
3. **Test failures**: Run `pnpm test` locally to reproduce

### Build Failures

1. **Missing environment variables**: Verify required secrets are configured for CI builds
2. **Build errors**: Check dependencies and build configuration

### Security Alerts

1. **CodeQL**: Review security tab for detailed findings
2. **Dependency vulnerabilities**: Update affected packages
3. **Secret detection**: Remove exposed secrets and rotate credentials

## Monitoring

- **Build status**: Check Actions tab for workflow status
- **Security alerts**: Review Security tab regularly  
- **Dependency updates**: Review and merge Dependabot PRs
- **Deployment status**: Monitor Vercel dashboard (already automated)

## Performance Optimization

The pipeline is optimized for speed:

- **Caching**: Dependencies and build artifacts cached
- **Parallelization**: Jobs run concurrently where possible  
- **Change detection**: Only affected packages are processed
- **Timeouts**: Reasonable limits prevent hanging builds

## Next Steps

1. **Set up branch protection rules** in repository settings
2. **Configure required secrets** for CI builds (if needed)
3. **Customize Dependabot reviewers** in `.github/dependabot.yml`  
4. **Add team notifications** for CI failures
5. **Monitor build performance** and optimize as needed

Note: Vercel deployment is already automated and doesn't require additional CI/CD setup.
# Charisma Development Guide

## Build/Test/Lint Commands
- `pnpm install` - Install dependencies
- `pnpm build` - Build all packages/apps
- `pnpm dev` - Start development servers
- `pnpm lint` - Run linting across all packages
- `pnpm test` - Run all tests
- `pnpm test -- <path/to/file.test.ts>` - Run single test file
- `pnpm check-types` - Type check TypeScript code

## Code Style Guidelines
- **TypeScript**: Use strict typing with explicit annotations
- **Imports**: Group external libraries first, then internal modules
- **Naming**: PascalCase for components/types/classes, camelCase for variables/functions
- **Functions**: Prefer arrow functions for utilities, named functions for components
- **Error Handling**: Use try/catch with specific error messages and proper logging
- **Documentation**: Use JSDoc comments for public functions and interfaces
- **Components**: Functional React components with hooks
- **Package Manager**: Use pnpm exclusively
- **Library Patterns**: Prefer object literals over classes for services and utilities
- **Object Creation**: Use factory functions and object literals instead of classes when possible
- **Service Implementation**: Implement services as simple objects with methods rather than classes
- **State Management**: Use closures for private state rather than class properties
- **Simplicity**: Keep all code changes simple and limited to what is requested

## Project Structure
- Monorepo using Turborepo and pnpm workspaces
- Each package/app is treated as a separate project
- Common configuration shared via workspace packages
- Source code lives in `src/` directories
- Tests in `__tests__/` directories

## Workflow
- Always clean up dead code if detect it
- Don't try to build apps unless I ask
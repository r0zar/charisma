# VS Code Workspace Configuration

This directory contains VS Code settings that apply to the entire monorepo workspace.

## Files

- **`settings.json`** - Workspace-wide editor settings including ESLint autofix on save
- **`extensions.json`** - Recommended extensions for all developers
- **`launch.json`** - Debug configurations for Next.js apps and Node scripts
- **`tasks.json`** - Common build and development tasks

## Features Enabled

### Auto-fix on Save
- **ESLint autofix** - Automatically fixes lint issues when saving files
- **Import sorting** - Organizes imports alphabetically
- **Code formatting** - Applies Prettier formatting
- **TypeScript strict mode** - Enhanced type checking

### Recommended Extensions
- ESLint, Prettier, Tailwind CSS IntelliSense
- TypeScript support with enhanced features
- Path IntelliSense, Auto Rename Tag
- Error Lens for inline error display

### Tasks Available
- **Fix All ESLint Issues** - `Ctrl+Shift+P` → "Tasks: Run Task" → "Fix All ESLint Issues"
- **Build All Apps** - Build entire monorepo
- **Start Bot Manager Dev** - Start development server
- **Type Check All** - Run TypeScript type checking

### Debug Configurations
- **Debug Next.js (bot-manager)** - Debug the bot-manager app
- **Debug Node Script** - Debug any Node.js script

## Usage

1. Open the workspace root in VS Code
2. Install recommended extensions when prompted
3. Save any file to trigger autofix
4. Use `Ctrl+Shift+P` to access tasks and debug configurations

## Commands

```bash
# From workspace root
pnpm --filter bot-manager lint:fix   # Fix specific app
pnpm lint:fix                        # Fix all apps (if available)
```
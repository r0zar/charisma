#!/bin/bash

# Script to check all Charisma app URLs
# This runs the discovery module's check-urls script

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Running Charisma URL Discovery Check...${NC}\n"

# Navigate to discovery module and run the check
cd modules/discovery || {
    echo -e "${RED}Error: Could not find modules/discovery directory${NC}"
    echo "Make sure you're running this script from the monorepo root"
    exit 1
}

# Run the check-urls script
pnpm check-urls

# Capture the exit code
EXIT_CODE=$?

# Return to original directory
cd - > /dev/null

# Exit with the same code as the check-urls script
exit $EXIT_CODE
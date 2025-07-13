/**
 * Help content for strategy editor
 */

import type { CodeExample, HelpContent, TroubleshootingItem } from './types';

export const quickStartExamples: CodeExample[] = [
  {
    id: 'basic-contract-call',
    title: 'Basic Contract Call',
    description: 'Simple example using @stacks/transactions directly',
    language: 'javascript',
    copyable: true,
    code: `// Import @stacks/transactions directly
const { makeContractCall, broadcastTransaction } = require('@stacks/transactions');

// Use bot context for wallet credentials
const transaction = await makeContractCall({
  contractAddress: 'SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE',
  contractName: 'powerful-farmer',
  functionName: 'execute-both',
  functionArgs: [],
  postConditionMode: 'allow',
  senderKey: bot.walletCredentials.privateKey
});

const result = await broadcastTransaction({ transaction });
console.log('Success! Transaction ID:', result.txid);`
  },
  {
    id: 'using-bots-basic',
    title: 'Using @bots/basic',
    description: 'Example using our convenience wrapper',
    language: 'javascript',
    copyable: true,
    code: `// Import our convenience utilities
const { createContractCaller } = require('@bots/basic');

// Create a contract caller with bot credentials
const caller = createContractCaller({ 
  privateKey: bot.walletCredentials.privateKey 
});

// Use convenience methods
const result = await caller.hootFarmer();
console.log('Hoot farmer executed:', result.txid);

// Or call any contract
const customResult = await caller.call(
  'SP1234...',     // Contract address
  'my-contract',   // Contract name
  'my-function',   // Function name
  []               // Function arguments
);`
  },
  {
    id: 'error-handling',
    title: 'Error Handling',
    description: 'Proper error handling for contract calls',
    language: 'javascript',
    copyable: true,
    code: `const { makeContractCall, broadcastTransaction } = require('@stacks/transactions');

try {
  const transaction = await makeContractCall({
    contractAddress: 'SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE',
    contractName: 'powerful-farmer',
    functionName: 'execute-both',
    functionArgs: [],
    postConditionMode: 'allow',
    senderKey: bot.walletCredentials.privateKey
  });

  const result = await broadcastTransaction({ transaction });
  console.log('Success:', result.txid);
  
} catch (error) {
  console.error('Contract call failed:', error.message);
  
  // Handle specific error types
  if (error.message.includes('insufficient funds')) {
    console.log('Not enough STX for transaction');
  } else if (error.message.includes('contract not found')) {
    console.log('Contract does not exist');
  }
}`
  }
];

export const troubleshootingItems: TroubleshootingItem[] = [
  {
    id: 'module-not-found',
    problem: 'Error: Cannot find module \'@stacks/transactions\'',
    solution: 'This means the package is not available in your configured repository. Make sure your Git repository has @stacks/transactions in its package.json dependencies, and that the build commands install it correctly.',
    code: `// Check your repository's package.json includes:
{
  "dependencies": {
    "@stacks/transactions": "^7.1.0"
  }
}

// And build commands install dependencies:
// Build Commands: ["pnpm install", "pnpm build"]`,
    relatedLinks: ['repository-config', 'package-discovery']
  },
  {
    id: 'private-key-missing',
    problem: 'Error: Private key is undefined or missing',
    solution: 'Make sure your bot has wallet credentials configured. Go to the bot\'s Wallet tab and either import an existing wallet or generate a new one.',
    code: `// Check if private key is available
if (!bot.walletCredentials.privateKey) {
  console.error('No private key configured for this bot');
  return;
}

console.log('Private key available:', !!bot.walletCredentials.privateKey);`,
    relatedLinks: ['bot-wallet-setup']
  },
  {
    id: 'build-failed',
    problem: 'Repository build failed or packages not available',
    solution: 'Check that your Git repository URL is correct, the subpath exists, and build commands are valid. Common issues include wrong branch, private repository access, or invalid build commands.',
    code: `// Valid repository configuration examples:
// Git URL: https://github.com/pointblankdev/charisma
// Subpath: bots/basic
// Build Commands: ["pnpm install", "pnpm build"]

// For private repositories, make sure they're accessible
// For monorepos, ensure the subpath is correct`,
    relatedLinks: ['repository-config']
  },
  {
    id: 'intellisense-not-working',
    problem: 'IntelliSense not showing available packages',
    solution: 'IntelliSense is populated based on your repository configuration. Make sure you\'ve configured a Git repository and the system has analyzed it. You can also try refreshing the page.',
    relatedLinks: ['repository-analysis']
  }
];

export const helpContent: HelpContent = {
  tabs: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      sections: [
        {
          id: 'overview',
          title: 'How Direct Import Works',
          content: `The strategy editor now uses **direct imports** - you write normal Node.js code and import packages using \`require()\` statements.

**Key Concepts:**
- Your bot strategies are JavaScript code that runs in a Node.js environment
- You import packages directly: \`const { makeContractCall } = require('@stacks/transactions')\`
- The \`bot\` object is automatically available with your bot's context and wallet credentials
- Available packages depend on your configured Git repository

**No More Magic Injection:**
Instead of pre-injected utilities, you explicitly import what you need. This makes code more predictable and follows standard Node.js patterns.`,
          examples: [quickStartExamples[0]],
          links: [
            {
              title: '@stacks/transactions Documentation',
              url: 'https://docs.stacks.co/docs/transactions',
              description: 'Official documentation for the Stacks transactions library'
            }
          ],
          searchTerms: ['import', 'require', 'direct', 'overview', 'how it works']
        },
        {
          id: 'bot-context',
          title: 'Bot Context Object',
          content: `The \`bot\` object is automatically available in your strategy code and contains your bot's information and wallet credentials.

**Available Properties:**
- \`bot.id\` - Your bot's unique identifier
- \`bot.name\` - Your bot's display name  
- \`bot.walletCredentials.privateKey\` - Private key for signing transactions

**Important:** The private key is only available if you've configured wallet credentials for your bot.`,
          examples: [
            {
              id: 'bot-context-example',
              title: 'Using Bot Context',
              description: 'How to access bot information and credentials',
              language: 'javascript',
              copyable: true,
              code: `// Access bot information
console.log('Bot ID:', bot.id);
console.log('Bot Name:', bot.name);

// Check if wallet is configured
if (bot.walletCredentials.privateKey) {
  console.log('Wallet is configured');
  
  // Use private key for transactions
  const transaction = await makeContractCall({
    // ... other parameters
    senderKey: bot.walletCredentials.privateKey
  });
} else {
  console.error('No wallet configured for this bot');
}`
            }
          ],
          links: [],
          searchTerms: ['bot', 'context', 'wallet', 'private key', 'credentials']
        }
      ]
    },
    {
      id: 'repository-config',
      title: 'Repository Setup',
      icon: '⚙️',
      sections: [
        {
          id: 'repository-basics',
          title: 'Repository Configuration',
          content: `Configure a Git repository to make packages available in your strategies. This determines what you can import and use.

**Configuration Fields:**
- **Git URL:** The repository containing your bot utilities (e.g., \`https://github.com/pointblankdev/charisma\`)
- **Subpath:** Path within the repository for monorepos (e.g., \`bots/basic\`)
- **Build Commands:** Commands to install and build the repository (e.g., \`["pnpm install", "pnpm build"]\`)

**How It Works:**
1. System clones your repository
2. Navigates to the subpath (if specified)
3. Runs build commands to install dependencies
4. Makes packages available for import in your strategies`,
          examples: [
            {
              id: 'charisma-repo-config',
              title: 'Using Charisma Repository',
              description: 'Configuration to use our reference implementation',
              language: 'javascript',
              copyable: false,
              code: `Git URL: https://github.com/pointblankdev/charisma
Subpath: bots/basic
Build Commands: ["pnpm install", "pnpm build"]

Available packages:
- @stacks/transactions (for contract calls)
- @bots/basic (our convenience utilities)`
            }
          ],
          links: [],
          searchTerms: ['repository', 'git', 'config', 'setup', 'subpath', 'build']
        },
        {
          id: 'package-discovery',
          title: 'Package Discovery',
          content: `The system automatically discovers available packages by analyzing your repository's \`package.json\` file.

**Discovery Process:**
1. Fetches \`package.json\` from your configured repository/subpath
2. Extracts \`dependencies\` and \`devDependencies\`
3. Loads TypeScript definitions for IntelliSense
4. Makes packages available for import

**IntelliSense Support:**
- Type definitions are automatically loaded for discovered packages
- Autocomplete shows available imports and methods
- Error checking validates your import statements`,
          examples: [],
          links: [],
          searchTerms: ['discovery', 'packages', 'package.json', 'intellisense', 'types']
        }
      ]
    },
    {
      id: 'examples',
      title: 'Code Examples',
      icon: '💻',
      sections: [
        {
          id: 'contract-calling',
          title: 'Contract Calling Patterns',
          content: `Examples of different ways to interact with Stacks smart contracts using the available packages.`,
          examples: quickStartExamples,
          links: [],
          searchTerms: ['contract', 'call', 'transaction', 'examples']
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      sections: [
        {
          id: 'common-issues',
          title: 'Common Issues',
          content: `Solutions to frequently encountered problems when writing bot strategies.`,
          examples: [],
          links: [],
          searchTerms: ['troubleshooting', 'errors', 'problems', 'help']
        }
      ]
    }
  ],
  quickStart: quickStartExamples,
  troubleshooting: troubleshootingItems
};
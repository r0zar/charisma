import ContractList from "@/components/ContractList";
import { getSavedSearches } from "./actions";
import { Metadata } from 'next';
import Link from 'next/link';

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'Contract Trait Search | Stacks Blockchain',
  description: 'Search for Stacks smart contracts by trait definition.',
  keywords: 'Stacks, Blockchain, Smart Contracts, Traits, ABI, Developer Tools',
  openGraph: {
    title: 'Contract Trait Search',
    description: 'Search for Stacks smart contracts by trait definition',
    type: 'website',
  },
};

export default async function Home() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Get all saved searches to pass to the ContractList component
  const savedSearches = await getSavedSearches();

  // Get an example search ID for the API link, if searches exist
  const exampleSearchId = savedSearches.length > 0 ? savedSearches[0].id : 'search-example';

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-16 bg-gray-50 dark:bg-gray-900">
      {/* Main content container with max width */}
      <div className="w-full max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Contract Trait Search</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Find Stacks smart contracts by trait definition</p>
        </header>

        {/* Introduction Text - Responsive Box */}
        <div className="w-full text-left text-sm text-gray-600 dark:text-gray-400 mb-8 space-y-4 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 rounded-lg bg-white dark:bg-gray-800/30 shadow-sm">
          <p className="flex items-start gap-3">
            <span className="text-lg mt-0.5 flex-shrink-0">🧩</span>
            <span className="break-words">
              Find contracts that implement specific traits (interfaces) on the Stacks blockchain.
              Enter a JSON trait definition to search for matching contracts.
            </span>
          </p>
          <p className="flex items-start gap-3">
            <span className="text-lg mt-0.5 flex-shrink-0">⚙️</span>
            <span className="break-words">
              This tool uses the <code className="break-all text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">searchContractsByTrait</code> method
              from the Hiro Blockchain API to search for contracts implementing specific traits.
            </span>
          </p>
          <p className="flex items-start gap-3">
            <span className="text-lg mt-0.5 flex-shrink-0">💾</span>
            <span className="break-words">
              Searches are saved automatically, so you can easily reference them later.
              Use the search templates to quickly find SIP-010 tokens or Dexterity protocol contracts.
            </span>
          </p>
          <p className="flex items-start gap-3">
            <span className="text-lg mt-0.5 flex-shrink-0">🔌</span>
            <span className="break-words">
              Access your searches and results through our REST API. View
              <Link href="/api/v1" className="text-blue-500 hover:underline mx-1">full API documentation</Link>
              or try examples:
              <code className="block mt-1 break-all text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                <Link href={`/api/v1/searches/${exampleSearchId}`} className="text-blue-500 hover:underline">/api/v1/searches/{exampleSearchId}</Link>
              </code>
              {/* Additional API endpoints coming soon */}
            </span>
          </p>
        </div>

        {/* ContractList component */}
        <ContractList isDevelopment={isDevelopment} initialSearches={savedSearches} />

        {/* Simple footer */}
        <footer className="mt-12 text-center text-xs text-gray-500 dark:text-gray-400 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p>Contract Trait Search &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </main>
  );
}

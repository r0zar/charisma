import { log } from "@repo/logger";
import SwapInterface from "../components/swap-interface";
import { listTokens } from "./actions";

export const metadata = {
  title: "Charisma DEX - Token Swap",
  description: "Swap tokens on the Charisma Decentralized Exchange",
};

export default async function Store() {
  log("Loading the DEX interface");

  // Prefetch tokens on the server
  const { success, tokens = [] } = await listTokens();

  return (
    <main className="container mx-auto max-w-7xl px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-secondary-600 via-primary-500 to-secondary-400 bg-clip-text text-transparent">
              Charisma Swap
            </h1>
            <p className="text-sm text-dark-600 mt-1">Fast, secure token swaps with zero protocol fees!</p>
          </div>
        </div>

        {/* Pass prefetched tokens to the client component */}
        <SwapInterface initialTokens={tokens} />
      </div>
    </main>
  );
}

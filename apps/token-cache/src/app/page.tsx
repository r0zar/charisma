import { getAllTokenData } from "@/lib/tokenService";
import { Metadata } from 'next';
import { List } from 'lucide-react'; // Import an icon
import ClientPage from "@/components/ClientPage";

// Update metadata if needed
export const metadata: Metadata = {
  title: 'Cached Tokens | Charisma Token Cache', // Specific title
  description: 'Browse the list of cached SIP-10 fungible tokens on the Stacks blockchain.',
};

export default async function HomePage() {
  // Pre-fetch token data on the server for hydration
  const tokens = await getAllTokenData();

  return (
    <main className="container py-8">
      <div className="flex items-center gap-3 mb-6">
        <List className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Cached Tokens</h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">
        This page displays the SIP-10 tokens currently managed and cached by the service.
        Use the inspector tool to check specific tokens or refresh their data.
      </p>

      <ClientPage initialTokens={tokens} />
    </main>
  );
}

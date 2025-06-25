import { getAllMetadataPaginated, getTokenCount } from "@/lib/tokenService";
import { Metadata } from 'next';
import { List } from 'lucide-react'; // Import an icon
import ClientPage from "@/components/ClientPage";

// Update metadata if needed
export const metadata: Metadata = {
  title: 'Cached Metadata | Charisma Cache', // Specific title
  description: 'Browse the list of cached metadata on the Stacks blockchain.',
};

interface HomePageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // Parse search parameters
  const page = Math.max(1, parseInt(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page || '1', 10));
  const limit = 20; // Fixed limit for now
  const search = Array.isArray(searchParams.search) ? searchParams.search[0] : searchParams.search || '';

  // Pre-fetch paginated token data on the server for hydration
  const [tokens, totalCount] = await Promise.all([
    getAllMetadataPaginated(page, limit, search),
    getTokenCount(search)
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasMore = page < totalPages;
  const hasPrevious = page > 1;

  const paginationInfo = {
    page,
    limit,
    total: totalCount,
    totalPages,
    hasMore,
    hasPrevious
  };

  return (
    <main className="container py-8">
      <div className="flex items-center gap-3 mb-6">
        <List className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">All Metadata</h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">
        This page displays the metadata currently managed and cached by the service.
        Use the inspector tool to check specific metadata or refresh their data.
      </p>

      <ClientPage 
        initialTokens={tokens} 
        initialPagination={paginationInfo}
        initialSearch={search}
      />
    </main>
  );
}

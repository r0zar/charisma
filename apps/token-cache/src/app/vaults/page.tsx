import { getAllMetadata } from "@/lib/tokenService";
import { Metadata } from 'next';
import { List } from 'lucide-react'; // Import an icon
import ClientPage from "@/components/ClientPage";

// Update metadata if needed
export const metadata: Metadata = {
    title: 'Cached Vaults | Charisma Token Cache',
    description: 'Browse the list of cached vaults on the Stacks blockchain.',
};

export default async function HomePage() {
    const metadataList = await getAllMetadata()
    const vaults = metadataList.filter((metadata) => metadata.type === 'SUBLINK' || metadata.type === 'POOL');

    console.log(vaults)

    return (
        <main className="container py-8">
            <div className="flex items-center gap-3 mb-6">
                <List className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Vaults</h1>
            </div>
            <p className="text-muted-foreground mb-6 max-w-2xl">
                This page displays the vaults currently managed and cached by the service.
                Use the inspector tool to check specific vaults or refresh their data.
            </p>

            <ClientPage initialTokens={vaults} />
        </main>
    );
}

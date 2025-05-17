import { headers } from "next/headers";
import OfferDetails from "@/components/otc/OfferDetails";
import BidForm from "@/components/otc/BidForm";
import { Offer, TokenDef } from "@/types/otc";
import { Toaster } from "sonner";
import { getOffer } from "@/lib/otc/kv";
import { kv } from "@vercel/kv";
import { EnhancedActiveBids } from "@/components/otc/ActiveBids";
import SocialShare from "@/components/otc/SocialShare";
import { WalletProvider } from "@/contexts/wallet-context";
import { listTokens } from "@/app/actions";
import { Header } from "@/components/header";
import { Offer as SchemaOffer, Bid as SchemaBid } from "@/lib/otc/schema";

interface PageProps { params: { intentUuid: string } }

export default async function OfferPage({ params }: PageProps) {
    const { intentUuid } = params; // No need to await params

    // Construct the full offer URL for sharing
    const headersList = await headers(); // Await the headers() call
    const host = headersList.get('host') || "localhost:3000";
    const protocol = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const offerUrl = `${protocol}://${host}/otc/${intentUuid}`;

    // Fetch and process tokens
    const tokensRes = await listTokens();
    const subnetTokens: TokenDef[] = tokensRes.success && tokensRes.tokens
        ? tokensRes.tokens.filter((t: any) => t.type === "SUBNET").map((t: any) => ({
            id: t.contractId,
            name: t.name,
            symbol: t.symbol,
            logo: t.image, // Assuming image maps to logo
            decimals: t.decimals,
            image: t.image,
            // type: t.type, // TokenDef from @/types/otc does not have type
        }))
        : [];

    // Fetch offer (likely returns SchemaOffer)
    const offer = await getOffer(intentUuid) as SchemaOffer | null;

    if (!offer) return <p className="p-8">Offer not found.</p>;
    if (subnetTokens.length === 0 && tokensRes.success) {
        // It's possible listTokens succeeded but no SUBNET tokens were found
        // Depending on requirements, this might be an error or just an empty list scenario.
        // For now, proceed but BidForm/ActiveBids might not behave well without tokens.
        console.warn("No SUBNET tokens found or processed for the UI.");
    }
    if (!tokensRes.success) return <p className="p-8">Failed to load tokens.</p>;

    return (
        <WalletProvider>
            <div className="relative flex min-h-screen flex-col">
                <Header />
                <main className="container grid max-w-4xl gap-6 py-8 grid-cols-1 md:grid-cols-2">
                    <OfferDetails offer={offer} subnetTokens={subnetTokens} />
                    {offer.status === "open" && (
                        <BidForm
                            intentUuid={intentUuid}
                            subnetTokens={subnetTokens}
                            offer={offer}
                        />
                    )}
                    {offer.status !== "open" && <div className="md:col-start-2"></div>}

                    <div className="md:col-span-2">
                        <SocialShare offerUrl={offerUrl} offerTitle={`Check out this offer for ${offer.offerAssets.map(a => a.token).join(', ')}`} />
                    </div>

                    <div className="md:col-span-2">
                        <EnhancedActiveBids
                            bids={offer.bids || []}
                            subnetTokens={subnetTokens}
                            offer={offer as any}
                        />
                    </div>
                </main>
                <Toaster />
            </div>
        </WalletProvider>
    );
}
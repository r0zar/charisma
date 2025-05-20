import { listTokens } from "@/app/actions";
import { Header } from "@/components/header";
import OfferForm from "@/components/otc/OfferForm";
import { TokenDef } from "@/types/otc";

export default async function NewOfferPage() {
    // preload subnet tokens
    const result = await listTokens();
    const subnetTokens: TokenDef[] = result.success
        ? result.tokens?.filter((t: any) => t.type === "SUBNET").map((t: any) => ({
            id: t.contractId,
            name: t.name,
            symbol: t.symbol,
            logo: t.image,
            decimals: t.decimals,
            image: t.image,
        })) || []
        : [];

    return (
        <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="container py-8 max-w-lg">
                <h1 className="mb-6 text-2xl font-bold">Marketplace Listing</h1>
                <OfferForm subnetTokens={subnetTokens} />
            </main>
        </div>
    );
}
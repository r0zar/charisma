import { Header } from "@/components/header";
import OfferForm from "@/components/otc/OfferForm";
import { ShopService } from "@/lib/shop/shop-service";

export default async function NewOfferPage() {
    // Use centralized service to get subnet tokens
    const subnetTokens = await ShopService.getSubnetTokensForOTC();

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
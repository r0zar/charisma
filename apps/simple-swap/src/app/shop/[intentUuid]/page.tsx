import { headers } from "next/headers";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import OfferDetails from "@/components/otc/OfferDetails";
import BidForm from "@/components/otc/BidForm";
import { toast, Toaster } from "sonner";
import { getOffer } from "@/lib/otc/kv";
import { OfferDetailContent } from "@/components/otc/OfferDetailContent";
import SocialShare from "@/components/otc/SocialShare";
import { WalletProvider } from "@/contexts/wallet-context";
import { Header } from "@/components/header";
import { Offer as SchemaOffer } from "@/lib/otc/schema";
import { CancelOffer } from "@/components/otc/CancelOffer";
import { ShopService } from "@/lib/shop/shop-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    TrendingUp,
    Clock,
    AlertCircle,
    ExternalLink,
    Users,
    Zap,
    Package,
    Shield,
    CheckCircle2,
    XCircle,
    Timer
} from "lucide-react";
import Link from "next/link";
import { getTokenMetadataCached } from "@repo/tokens";

interface PageProps {
    params: { intentUuid: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { intentUuid } = await params;

    try {
        const offer = await getOffer(intentUuid) as SchemaOffer | null;

        if (!offer) {
            return {
                title: "Offer Not Found | Charisma Shop",
                description: "The requested offer could not be found.",
            };
        }

        // Get token info for better metadata
        const firstAsset = offer.offerAssets?.[0];
        let tokenInfo = null;
        if (firstAsset?.token) {
            try {
                tokenInfo = await getTokenMetadataCached(firstAsset.token);
            } catch (error) {
                console.warn(`Failed to fetch token metadata for SEO: ${firstAsset.token}`);
            }
        }

        const tokenSymbols = offer.offerAssets
            ?.map(asset => tokenInfo?.symbol || asset.token.split('.')[1])
            .filter(Boolean)
            .join(', ') || 'tokens';

        const title = `${tokenSymbols} Offer | Charisma Shop`;
        const description = `Make a bid on this ${tokenSymbols} offer. ${offer.bids?.length || 0} bids received.`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                type: "website",
                images: tokenInfo?.image ? [tokenInfo.image] : undefined,
            },
            twitter: {
                card: "summary",
                title,
                description,
                images: tokenInfo?.image ? [tokenInfo.image] : undefined,
            },
        };
    } catch (error) {
        console.error("Error generating metadata:", error);
        return {
            title: "Offer | Charisma Shop",
            description: "View and bid on token offers",
        };
    }
}

export default async function OfferPage({ params }: PageProps) {
    const { intentUuid } = await params;

    // Validate UUID format
    if (!intentUuid || typeof intentUuid !== 'string') {
        notFound();
    }

    try {
        // Fetch data in parallel for better performance
        const [offer, subnetTokens] = await Promise.all([
            getOffer(intentUuid) as Promise<SchemaOffer | null>,
            ShopService.getSubnetTokensForOTC()
        ]);

        // Handle missing offer
        if (!offer) {
            return (
                <WalletProvider>
                    <div className="relative flex min-h-screen flex-col">
                        <Header />
                        <main className="container max-w-4xl py-8">
                            <OfferNotFound intentUuid={intentUuid} />
                        </main>
                    </div>
                </WalletProvider>
            );
        }

        // Fetch token metadata for all offer assets
        const offerTokenMetadata: Record<string, any> = {};
        if (offer.offerAssets && offer.offerAssets.length > 0) {
            const tokenPromises = offer.offerAssets.map(async (asset) => {
                try {
                    const tokenData = await getTokenMetadataCached(asset.token);
                    return { tokenId: asset.token, tokenData };
                } catch (error) {
                    console.warn(`Failed to fetch token metadata for ${asset.token}:`, error);
                    return { tokenId: asset.token, tokenData: null };
                }
            });

            const tokenResults = await Promise.all(tokenPromises);
            tokenResults.forEach(({ tokenId, tokenData }) => {
                if (tokenData) {
                    offerTokenMetadata[tokenId] = {
                        id: tokenData.contractId,
                        name: tokenData.name || tokenId.split('.')[1] || 'Unknown Token',
                        symbol: tokenData.symbol || tokenId.split('.')[1] || 'Unknown',
                        logo: tokenData.image || '',
                        decimals: tokenData.decimals || 6,
                    };
                }
            });
        }

        // Construct the full offer URL for sharing
        const offerUrl = `https://swap.charisma.rocks/shop/${intentUuid}`;

        // Get offer status info
        const statusConfig = getOfferStatusConfig(offer.status);
        const bidCount = offer.bids?.length || 0;
        const isActive = offer.status === "open";

        return (
            <WalletProvider>
                <div className="relative flex min-h-screen flex-col">
                    <Header />

                    <main className="container max-w-6xl py-8">
                        {/* Navigation */}
                        <div className="mb-6">
                            <Link
                                href="/shop"
                                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Shop
                            </Link>
                        </div>

                        {/* Header Section */}
                        <div className="mb-8">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl lg:text-3xl font-bold">
                                            {generateOfferTitle(offer.offerAssets || [], offerTokenMetadata)}
                                        </h1>
                                        <Badge className={statusConfig.badgeClass}>
                                            <statusConfig.icon className="h-3 w-3 mr-1" />
                                            {offer.status}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground mb-4">
                                        {bidCount} bid{bidCount !== 1 ? 's' : ''} • {offer.offerAssets?.length || 0} asset{offer.offerAssets?.length !== 1 ? 's' : ''} • Created {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Status Alert */}
                            {!isActive && (
                                <Alert className={statusConfig.alertClass}>
                                    <statusConfig.icon className="h-4 w-4" />
                                    <AlertDescription>
                                        {statusConfig.message}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid gap-8 lg:grid-cols-3">
                            {/* Main Content - 2 columns */}
                            <div className="lg:col-span-2 space-y-6">
                                <OfferDetailContent
                                    offer={offer}
                                    subnetTokens={subnetTokens}
                                    offerTokenMetadata={offerTokenMetadata}
                                />
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">

                                {/* Creator Info */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="h-5 w-5" />
                                            Offer Creator
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                                                <Users className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">
                                                    {offer.offerCreatorAddress.slice(0, 8)}...{offer.offerCreatorAddress.slice(-4)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">Creator</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                {/* Bid Form or Status */}
                                <Card className="sticky top-8">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            {isActive ? (
                                                <>
                                                    <Zap className="h-5 w-5 text-primary" />
                                                    Place Your Bid
                                                </>
                                            ) : (
                                                <>
                                                    <Shield className="h-5 w-5 text-muted-foreground" />
                                                    Offer Status
                                                </>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {isActive ? (
                                            <BidForm
                                                intentUuid={intentUuid}
                                                subnetTokens={subnetTokens}
                                                offer={offer}
                                            />
                                        ) : (
                                            <ClosedOfferInfo offer={offer} />
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Social Share */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Share</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <SocialShare
                                            offerUrl={offerUrl}
                                            offerTitle={`Check out this offer for ${offer.offerAssets?.map(a => a.token.split('.')[1]).join(', ') || 'tokens'}`}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </main>
                </div>
            </WalletProvider>
        );

    } catch (error) {
        console.error("Error loading offer page:", error);

        return (
            <WalletProvider>
                <div className="relative flex min-h-screen flex-col">
                    <Header />
                    <main className="container max-w-4xl py-8">
                        <OfferError error={error} intentUuid={intentUuid} />
                    </main>
                </div>
            </WalletProvider>
        );
    }
}

// Helper function to generate offer title
function generateOfferTitle(assets: any[], tokenMetadata: Record<string, any>): string {
    if (!assets || assets.length === 0) return 'Token Offer';

    const symbols = assets
        .map(asset => tokenMetadata[asset.token]?.symbol || asset.token.split('.')[1])
        .filter(Boolean);

    if (symbols.length === 0) return 'Multi-Token Offer';
    if (symbols.length === 1) return `${symbols[0]} Token Offer`;
    if (symbols.length <= 3) return `${symbols.join(' + ')} Bundle`;

    return `${symbols.slice(0, 2).join(' + ')} & ${symbols.length - 2} More`;
}

// Helper function to get offer status configuration
function getOfferStatusConfig(status: string) {
    switch (status) {
        case "open":
            return {
                icon: TrendingUp,
                message: "This offer is open for bidding",
                alertClass: "border-primary/20 bg-primary/5 text-primary",
                badgeClass: "bg-primary text-primary-foreground"
            };
        case "closed":
            return {
                icon: Clock,
                message: "This offer has been closed and is no longer accepting bids",
                alertClass: "border-muted-foreground/20 bg-muted/5 text-muted-foreground",
                badgeClass: "bg-muted text-muted-foreground"
            };
        case "accepted":
            return {
                icon: CheckCircle2,
                message: "This offer has been accepted and completed",
                alertClass: "border-secondary/20 bg-secondary/5 text-secondary",
                badgeClass: "bg-secondary text-secondary-foreground"
            };
        default:
            return {
                icon: AlertCircle,
                message: `This offer is ${status}`,
                alertClass: "border-muted-foreground/20 bg-muted/5 text-muted-foreground",
                badgeClass: "bg-muted text-muted-foreground"
            };
    }
}

// Component for closed offer information
function ClosedOfferInfo({ offer }: { offer: SchemaOffer }) {
    const statusConfig = getOfferStatusConfig(offer.status);

    return (
        <div className="space-y-4">
            <div className="text-center p-6 bg-muted/30 rounded-lg">
                <statusConfig.icon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-2">Offer Closed</h3>
                <p className="text-sm text-muted-foreground">
                    This offer is no longer accepting new bids.
                </p>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Final Status:</span>
                    <Badge className={statusConfig.badgeClass}>
                        {offer.status}
                    </Badge>
                </div>
                {offer.bids && offer.bids.length > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Bids:</span>
                        <span className="font-medium">{offer.bids.length}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// Component for offer not found
function OfferNotFound({ intentUuid }: { intentUuid: string }) {
    return (
        <div className="text-center py-16">
            <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="h-12 w-12 text-muted-foreground" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Offer Not Found</h1>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                    The offer with ID "<code className="bg-muted px-2 py-1 rounded text-sm">{intentUuid}</code>" could not be found.
                    It may have been removed or the link is incorrect.
                </p>
                <div className="space-y-4">
                    <Link href="/shop">
                        <Button size="lg" className="w-full">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Return to Shop
                        </Button>
                    </Link>
                    <Link href="/shop/new">
                        <Button variant="outline" size="lg" className="w-full">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Create New Offer
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

// Component for error handling
function OfferError({ error, intentUuid }: { error: any; intentUuid: string }) {
    return (
        <div className="text-center py-16">
            <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Error Loading Offer</h1>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    There was an error loading the offer. Please try again later.
                </p>
                <details className="text-left mb-8 bg-muted/30 p-4 rounded-lg">
                    <summary className="cursor-pointer text-sm font-medium mb-2">Technical Details</summary>
                    <pre className="text-xs overflow-auto bg-background p-3 rounded border">
                        {error?.message || String(error)}
                    </pre>
                </details>
                <div className="space-y-4">
                    <Button
                        onClick={() => window.location.reload()}
                        size="lg"
                        className="w-full"
                    >
                        <Timer className="h-4 w-4 mr-2" />
                        Try Again
                    </Button>
                    <Link href="/shop">
                        <Button variant="outline" size="lg" className="w-full">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Return to Shop
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
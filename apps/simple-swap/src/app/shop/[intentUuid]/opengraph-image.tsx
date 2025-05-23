import { ImageResponse } from 'next/og';
import { getOffer } from '@/lib/otc/kv';
import { getTokenMetadataCached } from '@repo/tokens';

export const runtime = 'edge';

export const alt = 'Charisma OTC Offer';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

interface Props {
    params: Promise<{ intentUuid: string }>;
}

export default async function Image({ params }: Props) {
    try {
        const { intentUuid } = await params;

        // Get offer data
        const offerData = await getOffer(intentUuid);
        if (!offerData) {
            throw new Error('Offer not found');
        }

        // Get token metadata for offered assets
        const tokenMetadata = await Promise.all(
            offerData.offerAssets.slice(0, 3).map(async (asset: any) => {
                try {
                    const metadata = await getTokenMetadataCached(asset.token);
                    return {
                        symbol: metadata?.symbol || asset.token.split('.')[1] || 'Token',
                        name: metadata?.name || 'Unknown Token',
                        amount: asset.amount,
                        decimals: metadata?.decimals || 6,
                    };
                } catch {
                    return {
                        symbol: asset.token.split('.')[1] || 'Token',
                        name: 'Unknown Token',
                        amount: asset.amount,
                        decimals: 6,
                    };
                }
            })
        );

        const bidCount = offerData.bids?.length || 0;
        const isMultiToken = offerData.offerAssets.length > 1;

        // Format amounts
        const formatAmount = (amount: string, decimals: number) => {
            const num = parseInt(amount) / Math.pow(10, decimals);
            return num.toLocaleString(undefined, {
                maximumFractionDigits: decimals > 6 ? 6 : decimals,
                minimumFractionDigits: 0,
            });
        };

        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        position: 'relative',
                    }}
                >
                    {/* Background Pattern */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            opacity: 0.05,
                            background: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10zm10 0c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10z'/%3E%3C/g%3E%3C/svg%3E")`,
                        }}
                    />

                    {/* Left Section - Offer Info */}
                    <div
                        style={{
                            flex: 1,
                            padding: 48,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            zIndex: 1,
                        }}
                    >
                        {/* Brand */}
                        <div
                            style={{
                                fontSize: 24,
                                color: '#94a3b8',
                                marginBottom: 8,
                                fontWeight: 300,
                            }}
                        >
                            Charisma Marketplace
                        </div>

                        {/* Offer Title */}
                        <div
                            style={{
                                fontSize: isMultiToken ? 48 : 56,
                                fontWeight: 'bold',
                                color: 'white',
                                lineHeight: 1.1,
                                marginBottom: 24,
                            }}
                        >
                            {isMultiToken
                                ? `Multi-Token Bundle`
                                : `${tokenMetadata[0]?.symbol || 'Token'} Offer`}
                        </div>

                        {/* Token Details */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                                marginBottom: 32,
                            }}
                        >
                            {tokenMetadata.slice(0, 2).map((token, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        padding: '12px 20px',
                                        borderRadius: 12,
                                        backdropFilter: 'blur(10px)',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 12,
                                            height: 12,
                                            backgroundColor: '#10b981',
                                            borderRadius: '50%',
                                            marginRight: 16,
                                        }}
                                    />
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <div
                                            style={{
                                                color: 'white',
                                                fontSize: 20,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {formatAmount(token.amount, token.decimals)} {token.symbol}
                                        </div>
                                        <div
                                            style={{
                                                color: '#94a3b8',
                                                fontSize: 14,
                                            }}
                                        >
                                            {token.name}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {offerData.offerAssets.length > 2 && (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '8px 20px',
                                        color: '#64748b',
                                        fontSize: 16,
                                    }}
                                >
                                    +{offerData.offerAssets.length - 2} more tokens
                                </div>
                            )}
                        </div>

                        {/* Creator */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                color: '#94a3b8',
                                fontSize: 16,
                            }}
                        >
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    backgroundColor: '#6366f1',
                                    borderRadius: '50%',
                                    marginRight: 12,
                                }}
                            />
                            Created by {offerData.offerCreatorAddress.slice(0, 8)}...{offerData.offerCreatorAddress.slice(-6)}
                        </div>
                    </div>

                    {/* Right Section - Stats */}
                    <div
                        style={{
                            width: 400,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: 48,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderLeft: '1px solid rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        {/* Status Badge */}
                        <div
                            style={{
                                backgroundColor: offerData.status === 'open' ? '#10b981' : '#6b7280',
                                color: 'white',
                                padding: '8px 24px',
                                borderRadius: 20,
                                fontSize: 14,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                marginBottom: 32,
                            }}
                        >
                            {offerData.status}
                        </div>

                        {/* Bid Count */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                marginBottom: 32,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 64,
                                    fontWeight: 'bold',
                                    color: 'white',
                                    lineHeight: 1,
                                }}
                            >
                                {bidCount}
                            </div>
                            <div
                                style={{
                                    fontSize: 18,
                                    color: '#94a3b8',
                                    marginTop: 8,
                                }}
                            >
                                {bidCount === 1 ? 'Bid' : 'Bids'}
                            </div>
                        </div>

                        {/* Created Date */}
                        <div
                            style={{
                                color: '#64748b',
                                fontSize: 14,
                                textAlign: 'center',
                            }}
                        >
                            {new Date(offerData.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </div>

                        {/* CTA */}
                        <div
                            style={{
                                marginTop: 32,
                                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                border: '1px solid #6366f1',
                                padding: '12px 24px',
                                borderRadius: 8,
                                color: '#a5b4fc',
                                fontSize: 14,
                                textAlign: 'center',
                            }}
                        >
                            {offerData.status === 'open' ? 'Place Your Bid' : 'View Details'}
                        </div>
                    </div>
                </div>
            ),
            {
                ...size,
            }
        );
    } catch (error) {
        console.error('Error generating offer OG image:', error);

        // Fallback image
        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                >
                    <div
                        style={{
                            fontSize: 48,
                            fontWeight: 'bold',
                            color: 'white',
                            marginBottom: 16,
                        }}
                    >
                        Charisma OTC Offer
                    </div>
                    <div
                        style={{
                            fontSize: 24,
                            color: '#94a3b8',
                        }}
                    >
                        View offer details
                    </div>
                </div>
            ),
            {
                ...size,
            }
        );
    }
} 
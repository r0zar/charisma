import { ImageResponse } from 'next/og';
import { getOffer } from '@/lib/otc/kv';

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

        // Get basic offer data with timeout protection
        const offerData = await Promise.race([
            getOffer(intentUuid),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 2000)
            )
        ]) as any;

        if (!offerData) {
            throw new Error('Offer not found');
        }

        const bidCount = offerData.bids?.length || 0;
        const tokenCount = offerData.offerAssets?.length || 0;
        const isMultiToken = tokenCount > 1;

        // Simple token symbol extraction without additional API calls
        const primaryTokenSymbol = offerData.offerAssets?.[0]?.token?.split('.')[1] || 'Token';

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
                            backgroundImage: 'radial-gradient(circle at 20px 20px, white 1px, transparent 0)',
                            backgroundSize: '40px 40px',
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
                                : `${primaryTokenSymbol} Offer`}
                        </div>

                        {/* Token Count Info */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                padding: '16px 24px',
                                borderRadius: 12,
                                marginBottom: 32,
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
                                    color: 'white',
                                    fontSize: 20,
                                    fontWeight: 600,
                                }}
                            >
                                {tokenCount} Token{tokenCount !== 1 ? 's' : ''} Available
                            </div>
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
                            Created by {offerData.offerCreatorAddress?.slice(0, 8) || 'Unknown'}...{offerData.offerCreatorAddress?.slice(-6) || ''}
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
                            {offerData.status || 'Open'}
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
                            {offerData.createdAt ?
                                new Date(offerData.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                }) : 'Recently created'
                            }
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
                            {(offerData.status === 'open' || !offerData.status) ? 'Place Your Bid' : 'View Details'}
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
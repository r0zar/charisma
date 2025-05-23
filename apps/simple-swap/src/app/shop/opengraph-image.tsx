import { ImageResponse } from 'next/og';
import { ShopService } from '@/lib/shop/shop-service';

export const runtime = 'edge';

export const alt = 'Charisma Marketplace';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
    try {
        // Get marketplace stats
        const allItems = await ShopService.getAllShopItems();
        const totalOffers = allItems.filter(item => item.type === 'offer').length;
        const totalBids = allItems.reduce((sum, item) => {
            if (item.type === 'offer') {
                return sum + ((item as any).bids?.length || 0);
            }
            return sum;
        }, 0);

        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                            opacity: 0.1,
                            background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }}
                    />

                    {/* Main Content */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            zIndex: 1,
                        }}
                    >
                        {/* Logo/Brand */}
                        <div
                            style={{
                                fontSize: 72,
                                fontWeight: 'bold',
                                color: 'white',
                                marginBottom: 16,
                                textShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            }}
                        >
                            Charisma
                        </div>

                        <div
                            style={{
                                fontSize: 32,
                                color: 'rgba(255,255,255,0.9)',
                                marginBottom: 48,
                                fontWeight: 300,
                            }}
                        >
                            Marketplace
                        </div>

                        {/* Stats */}
                        <div
                            style={{
                                display: 'flex',
                                gap: 64,
                                alignItems: 'center',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    padding: '24px 32px',
                                    borderRadius: 16,
                                    backdropFilter: 'blur(10px)',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 48,
                                        fontWeight: 'bold',
                                        color: 'white',
                                    }}
                                >
                                    {totalOffers}
                                </div>
                                <div
                                    style={{
                                        fontSize: 18,
                                        color: 'rgba(255,255,255,0.8)',
                                        marginTop: 4,
                                    }}
                                >
                                    Active Offers
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    padding: '24px 32px',
                                    borderRadius: 16,
                                    backdropFilter: 'blur(10px)',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 48,
                                        fontWeight: 'bold',
                                        color: 'white',
                                    }}
                                >
                                    {totalBids}
                                </div>
                                <div
                                    style={{
                                        fontSize: 18,
                                        color: 'rgba(255,255,255,0.8)',
                                        marginTop: 4,
                                    }}
                                >
                                    Total Bids
                                </div>
                            </div>
                        </div>

                        {/* Subtitle */}
                        <div
                            style={{
                                fontSize: 24,
                                color: 'rgba(255,255,255,0.7)',
                                marginTop: 48,
                                maxWidth: 600,
                                lineHeight: 1.4,
                            }}
                        >
                            Trade tokens, place bids on offers, and discover new opportunities
                        </div>
                    </div>
                </div>
            ),
            {
                ...size,
            }
        );
    } catch (error) {
        console.error('Error generating marketplace OG image:', error);

        // Fallback simple image
        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                            fontSize: 72,
                            fontWeight: 'bold',
                            color: 'white',
                            marginBottom: 16,
                        }}
                    >
                        Charisma
                    </div>
                    <div
                        style={{
                            fontSize: 32,
                            color: 'rgba(255,255,255,0.9)',
                        }}
                    >
                        Marketplace
                    </div>
                </div>
            ),
            {
                ...size,
            }
        );
    }
} 
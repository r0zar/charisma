import { ImageResponse } from 'next/og';
import { TrendingUp, Rocket } from 'lucide-react';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'Meme Roulette - Group Token Pumper';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

// Image generation
export default async function Image() {
    try {
        // Font
        const interBold = fetch(
            new URL('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap')
        ).then((res) => res.arrayBuffer());

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#09090b',
                        backgroundImage: 'radial-gradient(circle at 25px 25px, #27272a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #27272a 2%, transparent 0%)',
                        backgroundSize: '100px 100px',
                        fontFamily: 'Space Grotesk',
                    }}
                >
                    {/* Colorful gradient background */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'radial-gradient(circle at 50% 50%, rgba(22, 163, 74, 0.15), transparent 70%)',
                            zIndex: 0,
                        }}
                    />

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            padding: 20,
                            borderRadius: 16,
                            backgroundColor: 'rgba(9, 9, 11, 0.85)',
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                            color: 'white',
                            marginBottom: 40,
                            zIndex: 10,
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            width: '80%',
                        }}
                    >
                        {/* Logo */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 80,
                                    height: 80,
                                    backgroundColor: '#16a34a',
                                    borderRadius: '50%',
                                    marginRight: 20,
                                }}
                            >
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                    <path d="M13 20H6.5C5.674 20 5 19.326 5 18.5L5 6.5C5 5.674 5.674 5 6.5 5H13"
                                        stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                                    <path d="M17 15L21 11L17 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M21 11L9 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                            </div>
                            <div>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 16.5C17.9 19.31 15.76 21.5 13 21.5H6C3.83 21.5 2 19.76 2 17.68V11.5C2 9.24 3.21 7.5 6 7.5H13C15.76 7.5 17.9 9.7 18 12.5M22 9.5L18 13.5L16 11.5"
                                        stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>

                        {/* Title */}
                        <div style={{ fontSize: 72, fontWeight: 'bold', marginBottom: 16, lineHeight: 1.1 }}>
                            Meme Roulette
                        </div>

                        {/* Subtitle */}
                        <div style={{
                            fontSize: 32,
                            opacity: 0.8,
                            marginBottom: 24,
                            background: 'linear-gradient(to right, #16a34a, #f59e0b)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: 'bold',
                        }}>
                            Group Token Pumper
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: 24, opacity: 0.7, maxWidth: 700 }}>
                            Collectively commit CHA to pump tokens on the Stacks blockchain
                        </div>
                    </div>
                </div>
            ),
            {
                ...size,
                fonts: [
                    {
                        name: 'Space Grotesk',
                        data: await interBold,
                        style: 'normal',
                        weight: 700,
                    },
                ],
            }
        );
    } catch (e) {
        console.error(`Error generating OG image: ${e}`);
        return new Response(`Failed to generate image`, {
            status: 500,
        });
    }
} 
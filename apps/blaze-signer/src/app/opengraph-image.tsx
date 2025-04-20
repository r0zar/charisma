import { ImageResponse } from 'next/og'

// Image metadata
export const alt = 'Blaze Protocol - Secure Off-Chain Signing for Stacks'
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = 'image/png'

// Font
export const runtime = 'edge'

// Export default function to generate the OpenGraph image
export default async function Image() {
    // Font
    const interBold = fetch(
        new URL('./fonts/Inter-Bold.woff2', import.meta.url)
    ).then((res) => res.arrayBuffer())

    const interRegular = fetch(
        new URL('./fonts/Inter-Regular.woff2', import.meta.url)
    ).then((res) => res.arrayBuffer())

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'linear-gradient(to bottom, #1a202c, #2d3748)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"Inter"',
                    color: 'white',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '2rem',
                    }}
                >
                    {/* Lightning icon for Blaze */}
                    <svg
                        width="64"
                        height="64"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ marginRight: '1rem' }}
                    >
                        <path
                            d="M13 3V10H20L11 21V14H4L13 3Z"
                            fill="#3B82F6"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <div
                        style={{
                            fontSize: 64,
                            fontWeight: 'bold',
                            background: 'linear-gradient(to right, #3B82F6, #60A5FA)',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        Blaze Protocol
                    </div>
                </div>
                <div
                    style={{
                        fontSize: 28,
                        letterSpacing: '-0.025em',
                        color: '#E2E8F0',
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        maxWidth: '800px',
                    }}
                >
                    Secure Off-Chain Signing with On-Chain Verification
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 18,
                        color: '#A0AEC0',
                    }}
                >
                    <div
                        style={{
                            padding: '8px 20px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#60A5FA',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                        }}
                    >
                        Built for Stacks Blockchain
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
            fonts: [
                {
                    name: 'Inter',
                    data: await interBold,
                    style: 'normal',
                    weight: 700,
                },
                {
                    name: 'Inter',
                    data: await interRegular,
                    style: 'normal',
                    weight: 400,
                },
            ],
        },
    )
} 
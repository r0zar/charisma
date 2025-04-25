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

// Export default function to generate the Twitter image
export default async function Image() {

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'linear-gradient(to bottom, #0F172A, #1E293B)',
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
                {/* Background pattern */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.1) 2px, transparent 0)',
                        backgroundSize: '50px 50px',
                        opacity: 0.4,
                    }}
                />

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '2rem',
                        zIndex: 10,
                    }}
                >
                    {/* Lightning bolt for Blaze */}
                    <svg
                        width="64"
                        height="64"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ marginRight: '1.5rem' }}
                    >
                        <path
                            d="M13 3V10H20L11 21V14H4L13 3Z"
                            fill="#3B82F6"
                            stroke="white"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <div
                        style={{
                            fontSize: 72,
                            fontWeight: 'bold',
                            background: 'linear-gradient(to right, #3B82F6, #93C5FD)',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        Blaze
                    </div>
                </div>
                <div
                    style={{
                        fontSize: 36,
                        letterSpacing: '-0.025em',
                        color: '#F8FAFC',
                        marginBottom: '2rem',
                        textAlign: 'center',
                        maxWidth: '800px',
                        fontWeight: 'bold',
                        zIndex: 10,
                    }}
                >
                    Fast, Secure Off-Chain Signatures
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(59, 130, 246, 0.2)',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        zIndex: 10,
                    }}
                >
                    <div
                        style={{
                            fontSize: 24,
                            color: 'white',
                            fontWeight: 'medium',
                        }}
                    >
                        #StacksBlockchain
                    </div>
                </div>
            </div>
        ),
        {
            ...size
        },
    )
} 
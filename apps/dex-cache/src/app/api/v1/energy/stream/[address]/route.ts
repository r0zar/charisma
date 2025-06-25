import { NextRequest } from 'next/server';
import { calculateRealTimeEnergyStatus } from '@/lib/energy/real-time';

/**
 * Server-Sent Events endpoint for real-time energy streaming
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { address: string } }
) {
    const userAddress = params.address;
    
    if (!userAddress) {
        return new Response('User address is required', { status: 400 });
    }

    console.log(`🌊 Starting energy stream for user: ${userAddress}`);

    const encoder = new TextEncoder();
    let intervalId: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            const initialMessage = `data: ${JSON.stringify({ 
                type: 'connected', 
                message: 'Energy stream connected',
                timestamp: Date.now() 
            })}\n\n`;
            controller.enqueue(encoder.encode(initialMessage));

            // Send real-time energy data every second
            intervalId = setInterval(async () => {
                try {
                    const energyData = await calculateRealTimeEnergyStatus(userAddress);
                    
                    const data = `data: ${JSON.stringify({
                        type: 'energy_update',
                        ...energyData
                    })}\n\n`;
                    
                    controller.enqueue(encoder.encode(data));
                } catch (error) {
                    console.error('Error in energy stream:', error);
                    
                    const errorData = `data: ${JSON.stringify({
                        type: 'error',
                        message: error instanceof Error ? error.message : 'Unknown error',
                        timestamp: Date.now()
                    })}\n\n`;
                    
                    controller.enqueue(encoder.encode(errorData));
                }
            }, 1000); // Update every second for smooth feel

            // Handle client disconnect
            request.signal.addEventListener('abort', () => {
                console.log(`🔌 Energy stream disconnected for user: ${userAddress}`);
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                controller.close();
            });
        },

        cancel() {
            console.log(`❌ Energy stream cancelled for user: ${userAddress}`);
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
        },
    });
}
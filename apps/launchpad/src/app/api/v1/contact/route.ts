// apps/launchpad/src/app/api/v1/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NotifierClient } from '@charisma/notifier';
import { z } from 'zod';

// Validation schema
const ContactRequestSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    projectName: z.string().min(1, "Project name is required"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    serviceType: z.enum(['custom', 'audit'], { message: "Service type must be 'custom' or 'audit'" }),
});

// Helper for CORS headers
function generateCorsHeaders(request: NextRequest, methods: string) {
    const headers = new Headers();
    const origin = request.headers.get('Origin');
    if (origin) {
        headers.set('Access-Control-Allow-Origin', origin);
    }
    headers.set('Access-Control-Allow-Methods', methods);
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Allow-Credentials', 'true');
    return headers;
}

export async function POST(request: NextRequest) {
    const corsHeaders = generateCorsHeaders(request, 'POST');

    try {
        const body = await request.json();
        const validatedRequest = ContactRequestSchema.parse(body);

        // Send notification to admin Telegram
        const adminTelegramId = process.env.ADMIN_TELEGRAM_USER_ID;
        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

        if (!adminTelegramId || !telegramBotToken) {
            console.error('Missing environment variables:');
            console.error('ADMIN_TELEGRAM_USER_ID:', adminTelegramId ? 'Set' : 'Missing');
            console.error('TELEGRAM_BOT_TOKEN:', telegramBotToken ? 'Set' : 'Missing');

            // Still return success to user, but log the issue
            return NextResponse.json({
                success: true,
                message: "Request submitted successfully. We'll contact you soon!"
            }, { status: 200, headers: corsHeaders });
        }

        const notifier = new NotifierClient(
            telegramBotToken, // Use the validated token
            undefined, // No Discord needed
            undefined, // No Twilio SID needed
            undefined, // No Twilio Auth needed
            undefined  // No Twilio Phone needed
        );

        const serviceTypeLabel = validatedRequest.serviceType === 'custom'
            ? 'Custom Development'
            : 'Smart Contract Audit';

        const message = `🔔 New ${serviceTypeLabel} Request

**${validatedRequest.projectName}**

👤 **Contact:** ${validatedRequest.name}
📧 **Email:** ${validatedRequest.email}

📝 **Description:**
${validatedRequest.description}

Reply to this message or contact ${validatedRequest.email} directly.`;

        try {
            await notifier.send('telegram', {
                recipient: { id: adminTelegramId },
                message: message
            });

            console.log('Notification sent successfully to admin');
        } catch (notifyError) {
            console.error('Failed to send notification:', notifyError);
            // Don't fail the request if notification fails
        } finally {
            // Clean up notifier resources
            if (typeof notifier.destroyAll === 'function') {
                try {
                    await notifier.destroyAll();
                } catch (cleanupError) {
                    console.error('Error cleaning up notifier:', cleanupError);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: "Request submitted successfully. We'll contact you soon!"
        }, { status: 200, headers: corsHeaders });

    } catch (error) {
        console.error('Error processing contact request:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                success: false,
                error: 'Validation failed',
                details: error.errors
            }, { status: 400, headers: corsHeaders });
        }

        return NextResponse.json({
            success: false,
            error: 'Failed to process contact request'
        }, { status: 500, headers: corsHeaders });
    }
}

export async function OPTIONS(request: NextRequest) {
    const headers = generateCorsHeaders(request, 'POST, OPTIONS');
    headers.set('Access-Control-Max-Age', '86400');
    return new NextResponse(null, { status: 204, headers });
}
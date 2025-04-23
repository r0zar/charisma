import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { image, filename } = await req.json();

        if (!image || !filename) {
            return NextResponse.json({
                success: false,
                error: 'Image data and filename are required'
            }, { status: 400 });
        }

        // Verify the image is a valid base64 string
        if (!image.startsWith('data:image/')) {
            return NextResponse.json({
                success: false,
                error: 'Invalid image format'
            }, { status: 400 });
        }

        // In a real application, you would:
        // 1. Upload the image to a storage service (S3, etc.)
        // 2. Get back a URL to the stored image

        // For this demo, we'll just return the base64 string as the URL
        // In a real app, replace this with your actual upload logic

        // For now, simulate a storage provider by simply returning the image
        // You would normally upload to S3, Cloudinary, etc. here
        const imageUrl = image;

        return NextResponse.json({
            success: true,
            imageUrl,
            message: 'Image uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process image upload'
        }, { status: 500 });
    }
}

// Set larger limit for image uploads (default is 4MB)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '8mb'
        }
    }
}; 
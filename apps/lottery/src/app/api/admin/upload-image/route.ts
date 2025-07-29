import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  
  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const extension = file.name.split('.').pop()
    const filename = `jackpot-${timestamp}.${extension}`

    console.log('Uploading jackpot image:', filename, 'Size:', file.size, 'bytes')

    // Upload to Vercel Blob Storage
    const blob = await put(`jackpot-images/${filename}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    })

    console.log('Image uploaded successfully:', blob.url)

    return NextResponse.json({
      success: true,
      data: {
        url: blob.url,
        filename: filename,
        size: file.size,
        type: file.type
      }
    })

  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
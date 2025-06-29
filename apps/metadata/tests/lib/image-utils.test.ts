import { describe, it, expect } from 'vitest'

describe('Image Utils', () => {
  describe('image format validation', () => {
    it('validates supported image formats', () => {
      const isValidImageType = (type: string) => {
        const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
        return supportedTypes.includes(type.toLowerCase())
      }
      
      expect(isValidImageType('image/png')).toBe(true)
      expect(isValidImageType('image/jpeg')).toBe(true)
      expect(isValidImageType('image/gif')).toBe(true)
      expect(isValidImageType('image/webp')).toBe(true)
      expect(isValidImageType('image/svg+xml')).toBe(false)
      expect(isValidImageType('text/plain')).toBe(false)
    })

    it('validates image file size', () => {
      const isValidFileSize = (size: number, maxSize = 5 * 1024 * 1024) => {
        return size > 0 && size <= maxSize
      }
      
      expect(isValidFileSize(1024)).toBe(true) // 1KB
      expect(isValidFileSize(1024 * 1024)).toBe(true) // 1MB
      expect(isValidFileSize(10 * 1024 * 1024)).toBe(false) // 10MB - too large
      expect(isValidFileSize(0)).toBe(false) // empty file
      expect(isValidFileSize(-1)).toBe(false) // invalid size
    })
  })

  describe('image dimension validation', () => {
    it('validates image dimensions', () => {
      const isValidDimensions = (width: number, height: number, maxDimension = 2048) => {
        return width > 0 && height > 0 && width <= maxDimension && height <= maxDimension
      }
      
      expect(isValidDimensions(512, 512)).toBe(true)
      expect(isValidDimensions(1024, 1024)).toBe(true)
      expect(isValidDimensions(2048, 2048)).toBe(true)
      expect(isValidDimensions(3000, 3000)).toBe(false) // too large
      expect(isValidDimensions(0, 512)).toBe(false) // invalid width
      expect(isValidDimensions(512, 0)).toBe(false) // invalid height
    })

    it('calculates aspect ratio', () => {
      const getAspectRatio = (width: number, height: number) => {
        return width / height
      }
      
      expect(getAspectRatio(512, 512)).toBe(1) // square
      expect(getAspectRatio(1024, 512)).toBe(2) // 2:1
      expect(getAspectRatio(512, 1024)).toBe(0.5) // 1:2
    })
  })

  describe('image URL generation', () => {
    it('generates proper blob URLs', () => {
      const generateBlobUrl = (filename: string, baseUrl = 'https://blob.vercel-storage.com') => {
        const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '-')
        return `${baseUrl}/${cleanFilename}`
      }
      
      expect(generateBlobUrl('test-image.png')).toBe('https://blob.vercel-storage.com/test-image.png')
      expect(generateBlobUrl('image with spaces.jpg')).toBe('https://blob.vercel-storage.com/image-with-spaces.jpg')
      expect(generateBlobUrl('special@chars#.png')).toBe('https://blob.vercel-storage.com/special-chars-.png')
    })
  })
})
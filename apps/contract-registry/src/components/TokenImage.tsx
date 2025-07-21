"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Code, Database, Shield } from 'lucide-react'
import type { ContractMetadata } from '@/lib/contract-registry'

interface TokenImageProps {
  contract: ContractMetadata
  size?: number
  className?: string
}

export function TokenImage({ contract, size = 40, className = "" }: TokenImageProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Extract image URL from token metadata
  const getTokenImageUrl = (contract: ContractMetadata): string | null => {
    try {
      // If contract has tokenMetadata, try to extract image
      if (contract.tokenMetadata) {
        let metadata: any
        
        if (typeof contract.tokenMetadata === 'string') {
          metadata = JSON.parse(contract.tokenMetadata)
        } else {
          metadata = contract.tokenMetadata
        }

        // Common image field names in token metadata
        const imageFields = ['image', 'image_uri', 'imageUri', 'logo', 'icon', 'logoUrl']
        
        for (const field of imageFields) {
          if (metadata[field] && typeof metadata[field] === 'string') {
            let imageUrl = metadata[field]
            
            // Handle IPFS URLs
            if (imageUrl.startsWith('ipfs://')) {
              imageUrl = `https://ipfs.io/ipfs/${imageUrl.slice(7)}`
            }
            
            // Basic URL validation
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
              return imageUrl
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse token metadata for image:', error)
    }
    
    return null
  }

  // Get fallback icon based on contract type
  const getFallbackIcon = (contractType: string) => {
    switch (contractType) {
      case 'token': return Code
      case 'nft': return Shield
      case 'vault': return Database
      default: return Database
    }
  }

  const imageUrl = getTokenImageUrl(contract)
  const FallbackIcon = getFallbackIcon(contract.contractType)
  
  // If no image URL or image failed to load, show fallback icon
  if (!imageUrl || imageError) {
    return (
      <div className={`flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 ${className}`} 
           style={{ width: size, height: size }}>
        <FallbackIcon className="text-primary/70" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    )
  }

  return (
    <div className={`flex-shrink-0 rounded-lg overflow-hidden bg-primary/10 border border-primary/20 ${className}`} 
         style={{ width: size, height: size }}>
      {isLoading && (
        <div className="w-full h-full flex items-center justify-center">
          <FallbackIcon className="text-primary/70" style={{ width: size * 0.5, height: size * 0.5 }} />
        </div>
      )}
      <Image
        src={imageUrl}
        alt={`${contract.contractName || contract.contractId} logo`}
        width={size}
        height={size}
        className={`object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true)
          setIsLoading(false)
        }}
        unoptimized // Allow external images
      />
    </div>
  )
}
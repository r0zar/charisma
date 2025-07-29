"use client"

import React, { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"

interface CarouselProps {
  images: string[]
  alt?: string
  autoSlideInterval?: number
  className?: string
}

export function Carousel({ 
  images, 
  alt = "", 
  autoSlideInterval = 5000,
  className = ""
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Ensure images is always an array
  const safeImages = images || []

  // Auto-slide functionality
  useEffect(() => {
    if (safeImages.length <= 1 || autoSlideInterval <= 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === safeImages.length - 1 ? 0 : prevIndex + 1
      )
    }, autoSlideInterval)

    return () => clearInterval(interval)
  }, [safeImages.length, autoSlideInterval])

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? safeImages.length - 1 : currentIndex - 1)
  }

  const goToNext = () => {
    setCurrentIndex(currentIndex === safeImages.length - 1 ? 0 : currentIndex + 1)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  if (!safeImages || safeImages.length === 0) {
    return (
      <div className={`w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-sm">No images available</span>
      </div>
    )
  }

  if (safeImages.length === 1) {
    return (
      <div className={`relative w-full h-48 ${className}`}>
        <img
          src={safeImages[0]}
          alt={alt}
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>
    )
  }

  return (
    <div className={`relative w-full h-48 group ${className}`}>
      {/* Main image */}
      <div className="relative w-full h-full overflow-hidden rounded-lg">
        <img
          src={safeImages[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      {/* Navigation buttons */}
      <Button
        variant="outline"
        size="sm"
        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={goToPrevious}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={goToNext}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Dots indicator */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {safeImages.map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              index === currentIndex ? 'bg-white' : 'bg-white/50'
            }`}
            onClick={() => goToSlide(index)}
            type="button"
          />
        ))}
      </div>

      {/* Image counter */}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {currentIndex + 1} / {safeImages.length}
      </div>
    </div>
  )
}
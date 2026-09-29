import { useRef, useCallback, useEffect, useState } from 'react'
import { useSpring, useTransform, useMotionValue, MotionValue } from 'framer-motion'

interface Use3DEffectResult {
  panelRef: React.RefObject<HTMLDivElement>
  rotateX: MotionValue<number>
  rotateY: MotionValue<number>
  z: MotionValue<number>
  isHovering: boolean
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  handleMouseMove?: (e: React.MouseEvent) => void
}

interface Use3DEffectConfig {
  sensitivityFactor?: number
  springConfig?: {
    damping: number
    stiffness: number
  }
  zTranslation?: number
}

/**
 * Hook to create 3D tilt effects for panels
 * Optimized version that prevents excessive re-renders
 */
export function use3DEffect(config: Use3DEffectConfig = {}): Use3DEffectResult {
  const {
    sensitivityFactor = 0.5,  // Increased sensitivity
    springConfig = { damping: 15, stiffness: 250 }, // Bouncier rotation
    zTranslation = 50  // More dramatic z-translation
  } = config

  const panelRef = useRef<HTMLDivElement>(null)

  // Motion values for 3D tilt effect
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Use a motion value for hover state instead of React state
  const hoverState = useMotionValue(0)

  // Create a new motion value for the tilt factor
  const tiltFactor = useMotionValue(1)

  // Update tilt factor when hover state changes
  useEffect(() => {
    const unsubscribe = hoverState.onChange(newValue => {
      // Reduce tilt by a factor of 2 when hovering
      tiltFactor.set(newValue === 1 ? 0.5 : 1)
    })
    return unsubscribe
  }, [hoverState])

  // Spring physics for smooth animation with much reduced sensitivity
  // Negative sign on yValue flips the rotation direction to be more natural
  const rotateX = useSpring(
    useTransform(
      [y, tiltFactor],
      ([yValue, factor]: number[]) => -yValue * 0.03 * factor // Negative sign to fix tilt direction
    ),
    springConfig
  )

  const rotateY = useSpring(
    useTransform(
      [x, tiltFactor],
      ([xValue, factor]: number[]) => xValue * 0.03 * factor // Keep positive for natural x-axis rotation
    ),
    springConfig
  )

  // Create spring animation for z - using the motion value instead of React state
  const z = useSpring(
    useTransform(hoverState, [0, 1], [0, zTranslation]),
    {
      // Sleek, controlled settings for sci-fi feel
      damping: 22,       // Higher damping for controlled movement
      stiffness: 200,    // Stiffer for faster, more precise movement
      mass: 0.8,         // Lower mass for quicker response
      restDelta: 0.01    // Larger threshold for quicker settling
    }
  )

  // Use state to track hover so components can react to changes
  const [isHovering, setIsHovering] = useState(false)

  // Update isHovering state when hoverState changes
  useEffect(() => {
    const unsubscribe = hoverState.onChange(value => {
      setIsHovering(value === 1)
    })
    return unsubscribe
  }, [hoverState])

  // Update mouse position using motion values
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect()
      const panelCenterX = rect.left + rect.width / 2
      const panelCenterY = rect.top + rect.height / 2

      // Calculate position relative to center of panel
      const relativeX = e.clientX - panelCenterX
      const relativeY = e.clientY - panelCenterY

      // Apply tilt effect regardless of hover state
      x.set(relativeX * sensitivityFactor)
      y.set(relativeY * sensitivityFactor)
    }
  }, [sensitivityFactor, x, y])

  // Component-specific mouse move handler (optional)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect()
      const panelCenterX = rect.left + rect.width / 2
      const panelCenterY = rect.top + rect.height / 2

      // Calculate position relative to center of panel
      const relativeX = e.clientX - panelCenterX
      const relativeY = e.clientY - panelCenterY

      // Apply tilt effect
      x.set(relativeX * sensitivityFactor)
      y.set(relativeY * sensitivityFactor)
    }
  }, [sensitivityFactor, x, y])

  // Smooth transition when mouse leaves
  const handleMouseLeave = useCallback(() => {
    hoverState.set(0)
  }, [hoverState])

  // Set hover state when mouse enters
  const handleMouseEnter = useCallback(() => {
    hoverState.set(1)
  }, [hoverState])

  // Set up global mouse move listener
  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [handleGlobalMouseMove])

  return {
    panelRef,
    rotateX,
    rotateY,
    z,
    isHovering,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove
  }
}
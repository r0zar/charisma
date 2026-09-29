import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { colors, tint } from '~shared/styles/theme'

interface ActionButtonProps {
  label: string
  color?: string
  active?: boolean
  animated?: boolean
  onClick: () => void
  children?: ReactNode
}

/**
 * Cyberpunk styled action button with animated state
 */
export default function ActionButton({
  label,
  color = colors.cyber,
  active = false,
  animated = false,
  onClick,
  children
}: ActionButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: `0 0 8px ${tint(color, 0.53)}` }}
      whileTap={{ scale: 0.95 }}
      animate={animated ? {
        y: [0, -3, 0],
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
      } : undefined}
      style={{
        background: `rgba(${color.match(/\d+/g)?.[0] || 125}, ${color.match(/\d+/g)?.[1] || 249}, ${color.match(/\d+/g)?.[2] || 255}, 0.1)`,
        border: `1px solid rgba(${color.match(/\d+/g)?.[0] || 125}, ${color.match(/\d+/g)?.[1] || 249}, ${color.match(/\d+/g)?.[2] || 255}, 0.4)`,
        borderRadius: '4px',
        padding: '6px 12px',
        color: color,
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
      onClick={onClick}
    >
      {children || (
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 4px ${color}`
        }} />
      )}
      {label}
    </motion.button>
  )
}
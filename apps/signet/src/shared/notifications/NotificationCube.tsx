import { motion } from 'framer-motion'
import { colors, tint } from '~shared/styles/theme'

interface Notification3DProps {
  color?: string
  label?: string
  onClose?: () => void
}

/**
 * Animated 3D cube notification display
 */
export default function NotificationCube({
  color = colors.cyber,
  label = 'SIGNET NOTIFICATION',
  onClose
}: Notification3DProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '200px',
        height: '200px',
        zIndex: 999998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `rgba(13, 17, 23, 0.7)`,
        backdropFilter: 'blur(4px)',
        borderRadius: '6px',
        border: `1px solid rgba(125, 249, 255, 0.3)`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 10px ${tint(color, 0.2)}`,
        overflow: 'hidden',
        pointerEvents: 'auto' // Enable pointer events for interaction
      }}
    >
      {/* Top shimmer line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '2px',
        background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
        opacity: 0.8
      }}>
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '50%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%)'
          }}
        />
      </div>

      {/* Background grid */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `
          linear-gradient(to right, rgba(125, 249, 255, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(125, 249, 255, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        opacity: 0.5
      }} />

      {/* The 3D Cube */}
      <motion.div
        animate={{
          rotateY: [0, 360],
          boxShadow: [
            `0 0 15px ${tint(color, 0.53)}`,
            `0 0 25px ${tint(color, 0.67)}`,
            `0 0 15px ${tint(color, 0.53)}`
          ]
        }}
        transition={{
          rotateY: { duration: 8, repeat: Infinity, ease: 'linear' },
          boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        }}
        style={{
          width: '80px',
          height: '80px',
          backgroundColor: color,
          position: 'relative',
          transform: 'perspective(500px) rotateX(45deg)',
          boxShadow: `0 0 15px ${tint(color, 0.53)}`
        }}
      />

      {/* Scanning line effect */}
      <motion.div
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: 0,
          width: '100%',
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${tint(color, 0.8)} 50%, transparent 100%)`,
          boxShadow: `0 0 5px ${tint(color, 0.8)}`
        }}
      />

      {/* Label */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: colors.white,
        background: `rgba(13, 17, 23, 0.7)`,
        padding: '2px 8px',
        borderRadius: '4px',
        border: `1px solid ${tint(colors.cyber, 0.2)}`
      }}>
        {label}
      </div>

      {/* Close button (if onClose provided) */}
      {onClose && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '20px',
            height: '20px',
            background: 'rgba(1, 4, 9, 0.7)',
            border: `1px solid ${tint(color, 0.4)}`,
            borderRadius: '50%',
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            cursor: 'pointer',
            zIndex: 1
          }}
        >
          ×
        </motion.button>
      )}
    </motion.div>
  )
}
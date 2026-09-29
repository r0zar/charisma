import { motion } from 'framer-motion'
import { colors, tint } from '~shared/styles/theme'

interface PanelFooterProps {
  version?: string
  isActive?: boolean
}

/**
 * Footer component for panels with status indicator
 */
export default function PanelFooter({
  version = 'v0.1.0',
  isActive = false
}: PanelFooterProps) {
  return (
    <div style={{
      borderTop: '1px solid rgba(125, 249, 255, 0.3)',
      padding: '6px 12px',
      background: 'rgba(1, 4, 9, 0.9)',
      fontSize: '10px',
      color: colors.steel,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isActive ? colors.neonGreen : colors.neonRed
          }}
        />
        <span>{isActive ? 'ACTIVE' : 'INACTIVE'}</span>
      </div>
      <div style={{ color: `${tint(colors.cyber, 0.7)}` }}>SIGNET {version}</div>
    </div>
  )
}
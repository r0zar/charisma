/**
 * The approval card: a Charisma dialog that tilts toward the mouse, floats while idle and grows to its drawn
 * size on hover (sharp, never stretched).
 *
 * Animated with react-spring and CSS (framer-motion 12 crashed rendering here: buildHTMLStyles read
 * opacity of undefined). The wrapper stays flat (no preserve-3d) so no half of the tilted card swings
 * behind it and drops the mouse.
 */
import { useState, type MouseEvent, type ReactNode } from 'react'
import { animated, to, useSpring } from '@react-spring/web'
import { Flame, X } from 'lucide-react'

interface NotificationPanelProps {
  title: string
  /** What the site asks, in plain words */
  children: ReactNode
  approveLabel: string
  onApprove: () => void
  onReject: () => void
  /** When set, Approve is held (dimmed, not clickable) and shows this text instead */
  approveHold?: string
}

const TILT = 0.03 // degrees per pixel from the card's center

const css = `
  @keyframes signet-card-in { from { opacity: 0; transform: translate(-50%, -50px) } to { opacity: 1; transform: translate(-50%, 0) } }
  @keyframes signet-card-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
  @media (prefers-reduced-motion: reduce) { .signet-card-float { animation: none !important } }
`

export default function NotificationPanel({ title, children, approveLabel, onApprove, onReject, approveHold }: NotificationPanelProps) {
  const [hovering, setHovering] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const spring = useSpring({
    rotateX: -tilt.y * TILT * (hovering ? 0.5 : 1),
    rotateY: tilt.x * TILT * (hovering ? 0.5 : 1),
    // Hover is the drawn size (sharp); resting is smaller, so the card is never magnified past it
    scale: hovering ? 1 : 0.94,
    config: { tension: 250, friction: 15 }
  })

  const track = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTilt({ x: (event.clientX - rect.left - rect.width / 2) * 0.5, y: (event.clientY - rect.top - rect.height / 2) * 0.5 })
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      zIndex: 999998,
      pointerEvents: 'auto',
      animation: 'signet-card-in 0.4s cubic-bezier(0.36, 0.66, 0.04, 1) both'
    }}>
      <style>{css}</style>
      {/* Idle float; perspective here so the tilted card below renders in 3D */}
      <div className="signet-card-float" style={{ perspective: '1000px', animation: hovering ? 'none' : 'signet-card-float 3s ease-in-out infinite' }}>
        <animated.div
          className="w-card"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => { setHovering(false); setTilt({ x: 0, y: 0 }) }}
          onMouseMove={track}
          style={{ transform: to([spring.rotateX, spring.rotateY, spring.scale], (x, y, s) => `rotateX(${x}deg) rotateY(${y}deg) scale(${s})`) }}
        >
          <div className="w-card-title">
            <span className="w-card-mark"><Flame size={18} strokeWidth={2.2} aria-hidden /></span>
            <h1>{title}</h1>
            <button type="button" className="cx-btn cx-btn-quiet w-btn-sm" onClick={onReject} aria-label="Deny and close" style={{ width: '32px', padding: 0 }}>
              <X size={16} aria-hidden />
            </button>
          </div>

          {children}

          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={onReject}>Deny</button>
            <button
              type="button"
              className="cx-btn cx-btn-primary"
              onClick={() => { if (!approveHold) onApprove() }}
              aria-disabled={!!approveHold}
            >
              {approveHold ?? approveLabel}
            </button>
          </div>
        </animated.div>
      </div>
    </div>
  )
}

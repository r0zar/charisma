/**
 * The 3D approval card: tilts toward the mouse, floats while idle, grows to its drawn size on hover (sharp,
 * never stretched), with pulsing corner accents, a glitch border and a shimmer line.
 *
 * Animated with react-spring and CSS (framer-motion 12 crashed rendering here: buildHTMLStyles read
 * opacity of undefined). The wrapper stays flat (no preserve-3d) so no half of the tilted card swings
 * behind it and drops the mouse.
 */
import { useState, type MouseEvent, type ReactNode } from 'react'
import { animated, to, useSpring } from '@react-spring/web'
import { colors, glow, tint } from '~shared/styles/theme'

export interface NotificationAction {
  id: string
  label: string
  action: 'approve' | 'reject' | 'dismiss'
  color?: string
}

export interface CardNotification {
  title: string
  color?: string
  customIcon?: ReactNode
  message: ReactNode
  actions: NotificationAction[]
}

interface NotificationPanelProps {
  notification: CardNotification
  onDismiss: () => void
  onApprove?: () => void
  onReject?: () => void
  /** When set, Approve is held (dimmed, not clickable) and shows this text instead */
  approveHold?: string
}

const TILT = 0.03 // degrees per pixel from the card's center

const css = (color: string) => `
  @keyframes signet-card-in { from { opacity: 0; transform: translate(-50%, -50px) } to { opacity: 1; transform: translate(-50%, 0) } }
  @keyframes signet-card-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
  @keyframes signet-card-corner { 0%, 100% { opacity: 0.4; box-shadow: 0 0 5px ${glow(color, 0.53)} } 50% { opacity: 1; box-shadow: 0 0 15px ${glow(color, 0.67)} } }
  @keyframes signet-card-glitch { 0%, 100% { opacity: 0.3 } 50% { opacity: 0.5 } }
  @keyframes signet-card-shimmer { from { transform: translateX(-100%) } to { transform: translateX(200%) } }
  .signet-card-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
  .signet-card-btn:hover { transform: scale(1.05); }
  .signet-card-btn:active { transform: scale(0.95); }
`

function Corner({ color, position, delay }: { color: string; position: 'tl' | 'tr' | 'bl' | 'br'; delay: number }) {
  const top = position[0] === 't'
  const left = position[1] === 'l'
  return (
    <div style={{
      position: 'absolute',
      [top ? 'top' : 'bottom']: 0,
      [left ? 'left' : 'right']: 0,
      width: '10px',
      height: '10px',
      [top ? 'borderTop' : 'borderBottom']: `2px solid ${color}`,
      [left ? 'borderLeft' : 'borderRight']: `2px solid ${color}`,
      [`border${top ? 'Top' : 'Bottom'}${left ? 'Left' : 'Right'}Radius`]: '6px',
      animation: `signet-card-corner 3s ease-in-out ${delay}s infinite`
    }} />
  )
}

export default function NotificationPanel({ notification, onDismiss, onApprove, onReject, approveHold }: NotificationPanelProps) {
  const color = notification.color || colors.accent
  const [hovering, setHovering] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const spring = useSpring({
    rotateX: -tilt.y * TILT * (hovering ? 0.5 : 1),
    rotateY: tilt.x * TILT * (hovering ? 0.5 : 1),
    // Hover is the drawn size (sharp); resting is smaller, so the card is never magnified past it
    scale: hovering ? 1 : 0.9,
    config: { tension: 250, friction: 15 }
  })

  const track = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTilt({ x: (event.clientX - rect.left - rect.width / 2) * 0.5, y: (event.clientY - rect.top - rect.height / 2) * 0.5 })
  }

  const handle = (action: NotificationAction['action']) => {
    if (action === 'approve') return !approveHold && onApprove?.()
    if (action === 'reject') return onReject?.()
    onDismiss()
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
      <style>{css(color)}</style>
      {/* Idle float; perspective here so the tilted card below renders in 3D */}
      <div style={{ perspective: '1000px', animation: hovering ? 'none' : 'signet-card-float 3s ease-in-out infinite' }}>
        <animated.div
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => { setHovering(false); setTilt({ x: 0, y: 0 }) }}
          onMouseMove={track}
          style={{
            width: '440px',
            borderRadius: '6px',
            overflow: 'hidden',
            transform: to([spring.rotateX, spring.rotateY, spring.scale], (x, y, s) => `rotateX(${x}deg) rotateY(${y}deg) scale(${s})`),
            boxShadow: hovering
              ? `0 20px 50px color-mix(in srgb, #000 calc(90% * var(--shade)), transparent), 0 0 25px ${glow(color, 0.67)}, 0 0 10px ${glow(color, 0.4)}`
              : `0 10px 30px color-mix(in srgb, #000 calc(80% * var(--shade)), transparent), 0 0 15px ${glow(color, 0.27)}, 0 0 5px ${glow(color, 0.13)}`,
            transition: 'box-shadow 0.2s ease'
          }}
        >
          <div style={{
            background: `linear-gradient(160deg, ${colors.bg} 0%, ${colors.surfaceRaised} 100%)`,
            border: `1px solid ${tint(color, 0.67)}`,
            borderRadius: '6px',
            padding: '2px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {hovering && (
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '6px',
                border: `1px solid ${tint(color, 0.53)}`,
                boxShadow: `inset 0 0 1px ${glow(color, 0.27)}`,
                mixBlendMode: 'screen',
                pointerEvents: 'none',
                animation: 'signet-card-glitch 2s ease-in-out infinite',
                clipPath: 'polygon(0% 1%, 100% 0%, 99.9% 99.5%, 0.2% 100%, 0% 75.2%, 0.2% 75.1%, 0.4% 75%, 0% 74.9%, 99.5% 50.1%, 99.7% 50%, 99.9% 49.9%, 99.5% 49.8%, 0.5% 25.1%, 0.3% 25%, 0.1% 24.9%, 0.5% 24.8%)'
              }} />
            )}
            <Corner color={color} position="tl" delay={0} />
            <Corner color={color} position="tr" delay={0.5} />
            <Corner color={color} position="bl" delay={1} />
            <Corner color={color} position="br" delay={1.5} />

            <div style={{ background: 'color-mix(in srgb, var(--bg) 90%, transparent)', padding: '15px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {notification.customIcon && (
                    <div style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {notification.customIcon}
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color, fontSize: '12px' }}>{notification.title}</div>
                </div>
                <button
                  type="button"
                  className="signet-card-btn"
                  onClick={onDismiss}
                  aria-label="Dismiss"
                  style={{ background: 'transparent', border: 'none', color: colors.ink, cursor: 'pointer', fontSize: '14px', width: '20px', height: '20px', padding: 0 }}
                >
                  ×
                </button>
              </div>

              <div style={{
                borderTop: `1px solid ${tint(color, 0.27)}`,
                borderBottom: `1px solid ${tint(color, 0.27)}`,
                margin: '5px 0',
                padding: '10px 0',
                position: 'relative'
              }}>
                {/* Shimmer along the top border */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', overflow: 'hidden', background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`, opacity: 0.8 }}>
                  <div style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--ink) 80%, transparent) 50%, transparent 100%)', animation: 'signet-card-shimmer 2s linear infinite' }} />
                </div>
                <div style={{ color: colors.ink, fontSize: '12px', fontFamily: 'var(--font-sans)', padding: '5px 10px', wordBreak: 'break-word' }}>
                  {notification.message}
                </div>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                {notification.actions.map(action => {
                  const actionColor = action.color || (action.action === 'approve' ? colors.success : action.action === 'reject' ? colors.danger : color)
                  const held = action.action === 'approve' && !!approveHold
                  return (
                    <div
                      key={action.id}
                      role="button"
                      className={held ? undefined : 'signet-card-btn'}
                      onClick={() => handle(action.action)}
                      style={{
                        fontSize: '10px',
                        flex: 1,
                        textAlign: 'center',
                        color: actionColor,
                        cursor: held ? 'not-allowed' : 'pointer',
                        opacity: held ? 0.4 : 1,
                        padding: '6px 8px',
                        border: `1px solid ${tint(actionColor, 0.4)}`,
                        borderRadius: '4px',
                        background: tint(actionColor, 0.07)
                      }}
                    >
                      {held ? approveHold : action.label}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </animated.div>
      </div>
    </div>
  )
}

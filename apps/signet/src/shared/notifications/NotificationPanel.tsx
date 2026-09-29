import { motion } from 'framer-motion'
import { use3DEffect } from '~shared/hooks/use3DEffect'
import { colors, tint } from '~shared/styles/theme'

interface NotificationPanelProps {
  notification: any
  isExiting?: boolean
  onDismiss: () => void
  onApprove?: () => void
  onReject?: () => void
  /** When set, Approve is held (dimmed, not clickable) and shows this text instead */
  approveHold?: string
}

/**
 * 3D animated notification panel with actionable buttons
 */
export default function NotificationPanel({
  notification,
  isExiting = false,
  onDismiss,
  onApprove,
  onReject,
  approveHold
}: NotificationPanelProps) {
  // Using the optimized 3D effect hook
  const {
    panelRef,
    rotateX,
    rotateY,
    isHovering,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove
  } = use3DEffect()


  const color = notification.color || colors.cyber

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: -30,
        filter: "blur(8px)",
        scale: 0.9,
        rotateX: 15
      }}
      transition={{
        duration: 0.4,
        ease: [0.36, 0.66, 0.04, 1]
      }}
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        translateX: '-50%',
        perspective: '1000px',
        zIndex: 999998,
        // Flat (no preserve-3d): the tilted panel is drawn into this layer, so no half of it swings
        // behind the layer and drops the mouse (hover flicker, missed clicks)
        pointerEvents: 'auto' // Make sure it can be interacted with
      }}
    >
      {/* 3D Panel */}
      <motion.div
        ref={panelRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        animate={{
          // Hover is the panel's drawn size (sharp); resting is smaller, so it's never stretched.
          // No z-translation: moving toward the viewer magnifies (blur), and pushing back hides it from clicks
          scale: isHovering ? 1 : 0.9,
          y: isHovering ? [0, 0] : [0, -5, 0]
        }}
        style={{
          width: '440px',
          borderRadius: '6px',
          overflow: 'hidden',
          transformStyle: 'preserve-3d',
          // Apply the spring-animated rotation
          rotateX,
          rotateY,
          // Enhanced visuals on hover
          boxShadow: isHovering
            ? `0 20px 50px rgba(0,0,0,0.9), 0 0 25px ${tint(color, 0.67)}, 0 0 10px ${tint(color, 0.4)}`
            : `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${tint(color, 0.27)}, 0 0 5px ${tint(color, 0.13)}`
        }}
        transition={{
          scale: {
            type: "spring",
            damping: 15,       // More controlled, less bouncy
            stiffness: 250,    // Stiffer for less oscillation
            mass: 0.8,         // Less mass for quicker response
            velocity: 0        // No initial velocity for smoother motion
          },
          y: { repeat: isHovering ? 0 : Infinity, duration: 3, ease: "easeInOut" },
          boxShadow: { duration: 0.2 }
        }}
      >
        {/* Panel Frame */}
        <div
          style={{
            background: `linear-gradient(160deg, ${colors.spaceBlack} 0%, ${colors.spaceDark} 100%)`,
            border: `1px solid ${tint(color, 0.67)}`,
            borderRadius: '6px',
            padding: '2px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Subtle glitch border effect on hover */}
          {isHovering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                times: [0, 0.5, 1]
              }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '6px',
                border: `1px solid ${tint(color, 0.53)}`,
                boxShadow: `inset 0 0 1px ${tint(color, 0.27)}`,
                background: 'transparent',
                mixBlendMode: 'screen',
                pointerEvents: 'none',
                clipPath: `polygon(
                    0% 1%, 100% 0%, 99.9% 99.5%, 0.2% 100%,
                    0% 75.2%, 0.2% 75.1%, 0.4% 75%, 0% 74.9%,
                    99.5% 50.1%, 99.7% 50%, 99.9% 49.9%, 99.5% 49.8%,
                    0.5% 25.1%, 0.3% 25%, 0.1% 24.9%, 0.5% 24.8%
                  )`
              }}
            />
          )}
          {/* Corner glow accents */}
          <motion.div
            animate={{
              opacity: [0.4, 1, 0.4],
              boxShadow: [
                `0 0 5px ${tint(color, 0.53)}`,
                `0 0 15px ${tint(color, 0.67)}`,
                `0 0 5px ${tint(color, 0.53)}`
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '10px',
              height: '10px',
              borderTop: `2px solid ${color}`,
              borderLeft: `2px solid ${color}`,
              borderTopLeftRadius: '6px'
            }}
          />
          <motion.div
            animate={{
              opacity: [0.4, 1, 0.4],
              boxShadow: [
                `0 0 5px ${tint(color, 0.53)}`,
                `0 0 15px ${tint(color, 0.67)}`,
                `0 0 5px ${tint(color, 0.53)}`
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '10px',
              height: '10px',
              borderTop: `2px solid ${color}`,
              borderRight: `2px solid ${color}`,
              borderTopRightRadius: '6px'
            }}
          />
          <motion.div
            animate={{
              opacity: [0.4, 1, 0.4],
              boxShadow: [
                `0 0 5px ${tint(color, 0.53)}`,
                `0 0 15px ${tint(color, 0.67)}`,
                `0 0 5px ${tint(color, 0.53)}`
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '10px',
              height: '10px',
              borderBottom: `2px solid ${color}`,
              borderLeft: `2px solid ${color}`,
              borderBottomLeftRadius: '6px'
            }}
          />
          <motion.div
            animate={{
              opacity: [0.4, 1, 0.4],
              boxShadow: [
                `0 0 5px ${tint(color, 0.53)}`,
                `0 0 15px ${tint(color, 0.67)}`,
                `0 0 5px ${tint(color, 0.53)}`
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '10px',
              height: '10px',
              borderBottom: `2px solid ${color}`,
              borderRight: `2px solid ${color}`,
              borderBottomRightRadius: '6px'
            }}
          />

          {/* Panel Content */}
          <div style={{
            background: `rgba(1, 4, 9, 0.9)`,
            padding: '15px',
            borderRadius: '4px'
          }}>
            {/* Panel Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {notification.customIcon ? (
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}

                  >
                    {notification.customIcon}
                  </div>
                ) : (
                  <motion.div
                    animate={{
                      boxShadow: [
                        `0 0 2px ${tint(color, 0.67)}`,
                        `0 0 8px ${tint(color, 0.87)}`,
                        `0 0 2px ${tint(color, 0.67)}`
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: color
                    }}
                  />
                )}
                <div style={{
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: color,
                  fontSize: '12px'
                }}>
                  {notification.title}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.white,
                  cursor: 'pointer',
                  fontSize: '14px',
                  width: '20px',
                  height: '20px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={onDismiss}
              >
                ×
              </motion.button>
            </div>

            {/* Panel Message */}
            <div style={{
              borderTop: `1px solid ${tint(color, 0.27)}`,
              borderBottom: `1px solid ${tint(color, 0.27)}`,
              margin: '5px 0',
              padding: '10px 0',
              position: 'relative'
            }}>
              {/* Shimmer effect on top border */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '1px',
                background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
                opacity: 0.8
              }}>
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: '50%',
                    height: '100%',
                    background: `linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%)`
                  }}
                />
              </div>

              <div style={{
                color: colors.white,
                fontSize: '12px',
                textAlign: 'center',
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: '5px 10px'
              }}>
                {/* Image content if provided */}
                {notification.imageUrl && (
                  <div style={{
                    margin: '0 auto 10px auto',
                    maxWidth: '100%',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: `1px solid ${tint(color, 0.27)}`
                  }}>
                    <img
                      src={notification.imageUrl}
                      alt="Notification image"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block'
                      }}
                    />
                  </div>
                )}

                {/* Handle content based on its type:
                    - htmlContent: render as HTML
                    - message: render as React component or string
                    - otherwise: undefined or empty */}
                {notification.htmlContent ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: notification.htmlContent }}
                    style={{
                      maxWidth: '100%',
                      wordBreak: 'break-word'
                    }}
                  />
                ) : (
                  <div style={{
                    maxWidth: '100%',
                    wordBreak: 'break-word',
                    textAlign: 'left'
                  }}>
                    {notification.message}
                  </div>
                )}

                {notification.details && (
                  <div style={{
                    fontSize: '10px',
                    color: colors.steel,
                    marginTop: '4px'
                  }}>
                    {notification.details}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Footer */}
            <div style={{
              marginTop: '10px'
            }}>
              {/* Timestamp */}
              {/* <div style={{
                fontSize: '6px',
                color: colors.steel,
                fontFamily: 'monospace',
                marginBottom: '8px'
              }}>
                TIMESTAMP: {notification.timestamp}
              </div> */}

              {/* Action buttons - custom if provided, or default based on type */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                {notification.actions && notification.actions.length > 0 ? (
                  // Custom action buttons
                  <>
                    {notification.actions.map(action => {
                      const actionColor = action.color || (
                        action.action === 'approve' ? colors.neonGreen :
                          action.action === 'reject' ? colors.neonRed :
                            color
                      );

                      // Determine which handler to use
                      const handleClick = () => {
                        switch (action.action) {
                          case 'approve':
                            if (!approveHold) onApprove && onApprove();
                            break;
                          case 'reject':
                            onReject && onReject();
                            break;
                          case 'dismiss':
                          default:
                            onDismiss();
                            break;
                        }
                      };

                      const held = action.action === 'approve' && !!approveHold;
                      return (
                        <motion.div
                          key={action.id}
                          whileHover={{ scale: 1.05, boxShadow: `0 0 8px ${tint(actionColor, 0.4)}` }}
                          whileTap={{ scale: 0.95 }}
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
                            background: `${tint(actionColor, 0.07)}`
                          }}
                          onClick={handleClick}
                        >
                          {held ? approveHold : action.label}
                        </motion.div>
                      );
                    })}
                  </>
                ) : notification.type === "OP_PREDICT" && onApprove && onReject ? (
                  // Default prediction market approval/rejection
                  <>
                    <motion.div
                      whileHover={{ scale: 1.05, boxShadow: `0 0 8px ${tint(colors.neonRed, 0.4)}` }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        fontSize: '10px',
                        flex: 1,
                        textAlign: 'center',
                        color: colors.neonRed,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        border: `1px solid ${tint(colors.neonRed, 0.4)}`,
                        borderRadius: '4px',
                        background: `${tint(colors.neonRed, 0.07)}`
                      }}
                      onClick={onReject}
                    >
                      REJECT
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.05, boxShadow: `0 0 8px ${tint(colors.neonGreen, 0.4)}` }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        fontSize: '10px',
                        flex: 1,
                        textAlign: 'center',
                        color: colors.neonGreen,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        border: `1px solid ${tint(colors.neonGreen, 0.4)}`,
                        borderRadius: '4px',
                        background: `${tint(colors.neonGreen, 0.07)}`
                      }}
                      onClick={onApprove}
                    >
                      APPROVE
                    </motion.div>
                  </>
                ) : (
                  // Default single dismiss button
                  <motion.div
                    whileHover={{ scale: 1.05, boxShadow: `0 0 8px ${tint(color, 0.4)}` }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      fontSize: '10px',
                      color: color,
                      cursor: 'pointer',
                      padding: '6px 8px',
                      border: `1px solid ${tint(color, 0.4)}`,
                      borderRadius: '4px',
                      background: `${tint(color, 0.07)}`,
                      width: '100%',
                      textAlign: 'center'
                    }}
                    onClick={onDismiss}
                  >
                    DISMISS
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
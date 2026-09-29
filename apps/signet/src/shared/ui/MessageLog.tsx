import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useTrail, a } from '@react-spring/web'
import { colors, keyframes } from '../styles/theme'
import type { Message } from 'signet-sdk/src/messaging';
import { MessageType } from 'signet-sdk/src/messaging';

// Trail component for staggered animations with cyberpunk theme
const Trail: React.FC<{
  open: boolean;
  delay?: number;
  children: React.ReactNode;
}> = ({ open, delay = 0, children }) => {
  const items = React.Children.toArray(children)
  const trail = useTrail(items.length, {
    // More rigid animation with minimal recoil
    config: { mass: 0.8, tension: 2500, friction: 120, clamp: true },
    // No opacity animation for more mechanical feel
    x: open ? 0 : 8, // Less movement for a firmer appearance
    // Remove height animation to prevent container resizing
    borderLeftWidth: open ? '2px' : '0px',
    filter: open ? 'blur(0px)' : 'blur(0.5px)', // Subtle blur
    boxShadow: open ? '0 0 8px rgba(125, 249, 255, 0.15)' : '0 0 0px rgba(125, 249, 255, 0)',
    // Faster staggered delay for a more mechanical feel
    delay: index => delay + index * 25,
    from: {
      // opacity removed for mechanical effect
      x: 8, // Match the smaller x movement 
      // height removed to prevent container snapping
      borderLeftWidth: '0px',
      filter: 'blur(0.5px)', // Subtle blur
      boxShadow: '0 0 0px rgba(125, 249, 255, 0)'
    },
  })

  return (
    <>
      {trail.map(({ borderLeftWidth, boxShadow, ...style }, index) => (
        <a.div key={index} style={{ ...style, overflow: 'hidden' }}>
          <a.div
            style={{
              position: 'relative',
              boxShadow,
              borderRadius: '4px',
              borderLeftWidth
            }}
          >
            {items[index]}
          </a.div>
        </a.div>
      ))}
    </>
  )
}

// Helper function to format a timestamp
const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return '00:00:00';
  }
};

// Helper function to get color based on message type
const getMessageColor = (msg: Message): string => {
  if (!msg.type) return colors.white;

  switch (msg.type) {
    case MessageType.CHECK_EXTENSION_INSTALLED:
      return colors.neonGreen;
    case MessageType.GET_STATUS:
      return colors.neonOrange;
    default:
      return colors.cyber;
  }
};

// Helper function to truncate long strings
const truncate = (str: string, length: number = 50): string => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

// Helper function to format data object into a string
const formatData = (data: any): string => {
  if (!data) return '';

  try {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      // Handle special case for common data shapes
      if (data.installed !== undefined) {
        return `installed: ${data.installed}${data.version ? `, version: ${data.version}` : ''}`;
      }
      if (data.connected !== undefined) {
        return `connected: ${data.connected}${data.activeSubnet ? `, subnet: ${data.activeSubnet}` : ''}`;
      }

      // Default object formatter
      return truncate(JSON.stringify(data));
    }
    return String(data);
  } catch (error) {
    return '[Error formatting data]';
  }
};

interface MessageLogProps {
  messages: Message[]
  maxHeight?: number
  expanded?: boolean
  onToggleExpand?: (expanded: boolean) => void
  showDetailedView?: boolean
}

/**
 * Displays log messages with cyberpunk styling
 */
export default function MessageLog({
  messages,
  maxHeight = 280,
  expanded: initialExpanded = false,
  onToggleExpand,
  showDetailedView = false
}: MessageLogProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [trailOpen, setTrailOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  // State to control overflow behavior
  const [showScrollbar, setShowScrollbar] = useState(false);
  
  // State to lock container height during transitions
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  // Initialize animation on component mount with a staggered entrance
  useEffect(() => {
    // Reset the animation state to trigger it
    if (messages.length > 0) {
      // Capture current container height before animation
      if (containerRef.current) {
        setContainerHeight(containerRef.current.scrollHeight);
      }
      setShowScrollbar(false);
      setTrailOpen(false);
      setTimeout(() => setTrailOpen(true), 150); // Quicker start for more mechanical feel
      // Enable scrolling after animation completes
      setTimeout(() => {
        setShowScrollbar(true);
        // Release height lock after animation completes
        setTimeout(() => {
          setContainerHeight(null);
          // Ensure scrolling after initial animation
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }
        }, 150);
      }, 600); // Shorter total animation time
    }
  }, []);

  // Auto-scroll to top when new messages are added
  useEffect(() => {
    // Scroll to top immediately for first load
    if (containerRef.current && messages.length > 0) {
      containerRef.current.scrollTop = 0;
    }
    
    // Ensure we scroll after animation completes too
    if (messages.length > prevMessagesLength.current && messages.length > 0) {
      const scrollToTop = () => {
        if (containerRef.current) {
          containerRef.current.scrollTop = 0;
        }
      };
      
      // Scroll immediately and again after animation
      scrollToTop();
      setTimeout(scrollToTop, 100);
      setTimeout(scrollToTop, 500);
    }

    // Reset and trigger animation when new messages arrive
    if (messages.length > prevMessagesLength.current) {
      // Lock container height before animation starts
      if (containerRef.current) {
        setContainerHeight(containerRef.current.scrollHeight);
      }
      // Temporarily hide scrollbar during animation
      setShowScrollbar(false);
      setTrailOpen(false);
      setTimeout(() => setTrailOpen(true), 50); // Faster response for mechanical feel
      // Show scrollbar after animation completes
      setTimeout(() => {
        setShowScrollbar(true);
        // Release height lock after animation completes
        setTimeout(() => {
          setContainerHeight(null);
          // Ensure we scroll to top after height lock is released
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }
        }, 100);
      }, 450); // Shorter complete animation time
    }

    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (onToggleExpand) {
      onToggleExpand(newExpanded);
    }
  };

  const handleMessageClick = (msg: Message) => {
    if (showDetailedView) {
      setSelectedMessage(selectedMessage?.id === msg.id ? null : msg);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        className="signet-scrollbar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{
          background: 'rgba(1, 4, 9, 0.9)',
          border: '1px solid rgba(125, 249, 255, 0.3)',
          borderRadius: '6px',
          padding: '12px',
          height: containerHeight ? `${containerHeight}px` : `${maxHeight}px`, // Locked height during transitions
          overflowY: showScrollbar ? 'auto' : 'overlay', // Use overlay to avoid layout shift
          overflowX: 'hidden',
          position: 'relative'
        }}
        ref={containerRef}
      >
        {/* Top shimmer for message log */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(125, 249, 255, 0.6) 50%, transparent 100%)',
            opacity: 0.6
          }}
        >
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '30%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%)'
            }}
          />
        </motion.div>

        {/* CRT scan lines effect */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'repeating-linear-gradient(0deg, rgba(125, 249, 255, 0.03) 0px, rgba(125, 249, 255, 0.03) 1px, transparent 1px, transparent 2px)',
          pointerEvents: 'none'
        }} />

        {/* Log Title removed - will be provided by parent component */}

        {/* Add padding at the top to make room for the header */}
        <div style={{ paddingTop: '30px' }}></div>

        {messages.length === 0 ? (
          <div style={{
            color: colors.steel,
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '10px',
            textAlign: 'center',
            background: 'rgba(125, 249, 255, 0.05)',
            borderRadius: '4px',
            border: '1px dashed rgba(125, 249, 255, 0.1)'
          }}>
            No messages intercepted yet...
            <div style={{ fontSize: '10px', marginTop: '4px', color: colors.steel }}>
              Messages will appear here when SDK communication occurs
            </div>
          </div>
        ) : (
          <div style={{ 
            minHeight: containerHeight ? `${containerHeight - 70}px` : `${maxHeight - 70}px`,
            position: 'relative'
          }}>
            <Trail open={trailOpen} delay={100}>
              {[...messages].reverse().map((msg, index) => (
              <div key={msg.id || index}>
                <motion.div
                  whileHover={{ backgroundColor: 'rgba(125, 249, 255, 0.06)' }}
                  onClick={() => handleMessageClick(msg)}
                  style={{
                    padding: '6px 8px',
                    margin: '3px 0',
                    borderRadius: '4px',
                    // Border is now controlled by the Trail animation
                    borderLeft: `solid ${getMessageColor(msg)}80`,
                    background: selectedMessage?.id === msg.id ? 'rgba(125, 249, 255, 0.1)' : 'transparent',
                    cursor: showDetailedView ? 'pointer' : 'default',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      color: getMessageColor(msg),
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      gap: '8px'
                    }}
                  >
                    {/* Message direction indicator */}
                    <div style={{
                      minWidth: '40px',
                      color: msg.request ? colors.neonOrange : colors.neonGreen,
                      fontSize: '9px',
                      background: msg.request ? 'rgba(255, 149, 0, 0.1)' : 'rgba(54, 199, 88, 0.1)',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      textAlign: 'center'
                    }}>
                      {msg.request ? "→ REQ" : (msg.response ? "← RES" : "EVENT")}
                    </div>

                    {/* Message type */}
                    <div style={{ flex: 1, fontWeight: 'bold' }}>
                      {msg.type}
                    </div>

                    {/* Timestamp */}
                    <div style={{
                      color: colors.steel,
                      fontSize: '9px',
                      opacity: 0.7
                    }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>

                  {/* Message data */}
                  <div style={{
                    marginTop: '3px',
                    color: colors.white,
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    whiteSpace: selectedMessage?.id === msg.id || isExpanded ? 'pre-wrap' : 'nowrap',
                    overflow: 'hidden',
                    textOverflow: selectedMessage?.id === msg.id || isExpanded ? 'clip' : 'ellipsis',
                    paddingLeft: '40px'
                  }}>
                    {formatData(msg.data)}
                  </div>

                  {/* Display message details if expanded */}
                  {selectedMessage?.id === msg.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        marginTop: '6px',
                        padding: '6px',
                        borderRadius: '4px',
                        background: 'rgba(1, 4, 9, 0.5)',
                        border: '1px solid rgba(125, 249, 255, 0.1)',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: colors.white
                      }}
                    >
                      <div style={{ marginBottom: '4px', color: colors.cyber, fontSize: '9px' }}>
                        ID: {msg.id}
                      </div>
                      <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: '150px',
                        overflowY: 'auto'
                      }}>
                        {JSON.stringify(msg, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </motion.div>
              </div>
            ))}
            </Trail>
          </div>
        )}
      </motion.div>

      {/* Removed expand/collapse toggle button */}

      {/* Add style for the scrollbar */}
      <style>{`
        .signet-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .signet-scrollbar::-webkit-scrollbar-track {
          background: rgba(1, 4, 9, 0.5);
          border-radius: 3px;
        }
        .signet-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(125, 249, 255, 0.3);
          border-radius: 3px;
          transition: background 0.3s ease;
        }
        .signet-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(125, 249, 255, 0.5);
        }
        .signet-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(125, 249, 255, 0.3) rgba(1, 4, 9, 0.5);
        }
      `}</style>
    </div>
  );
}
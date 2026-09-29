/**
 * LogsTab - Enhanced message log display for debugging SDK communication
 * Shows detailed message flow between web apps and extension
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSignetContext } from '~shared/context/SignetContext';
import MessageLog from '~shared/ui/MessageLog';
import { colors } from '~shared/styles/theme';
import { type Message } from 'signet-sdk/src/messaging';

export function LogsTab() {
  const { messages, error, pendingPermissions } = useSignetContext();
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'request' | 'response'>('all');

  // Apply filtering to messages
  useEffect(() => {
    if (!messages) return;

    let filtered = [...messages];

    // Apply filters
    if (filter === 'request') {
      filtered = filtered.filter(msg => msg.request === true);
    } else if (filter === 'response') {
      filtered = filtered.filter(msg => !!msg.response);
    }

    setAllMessages(filtered);
  }, [messages, filter]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      {/* Pending permissions indicator */}
      {pendingPermissions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            padding: '8px 12px',
            background: 'rgba(255, 149, 0, 0.1)',
            border: '1px solid rgba(255, 149, 0, 0.3)',
            borderRadius: '4px',
            color: colors.neonOrange,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}
        >
          <div>
            <span style={{ fontWeight: 'bold' }}>
              {pendingPermissions.length}
            </span> permission request{pendingPermissions.length > 1 ? 's' : ''} pending approval
          </div>
          <div style={{
            fontSize: '10px',
            background: 'rgba(255, 149, 0, 0.2)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Check notifications panel
          </div>
        </motion.div>
      )}

      {/* Main message log with integrated header */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Integrated header */}
        <div style={{
          position: 'absolute',
          top: '0px',
          left: '0px',
          right: '0px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(125, 249, 255, 0.2)',
          padding: '12px 12px 6px',
          backgroundColor: 'rgba(1, 4, 9, 0.95)',
          backdropFilter: 'blur(2px)',
          pointerEvents: 'none' // Allow clicks to pass through to log items underneath
        }}>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: colors.cyber,
            fontWeight: 'bold',
            pointerEvents: 'auto' // Make header clickable again
          }}>
            MESSAGE LOG
          </div>

          {/* Filters with counter - Connected multi-button style */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              color: colors.steel,
              fontSize: '10px',
              fontFamily: 'monospace'
            }}>
              {allMessages.length} events
            </span>
            <div style={{
              display: 'flex',
              overflow: 'hidden',
              borderRadius: '4px',
              border: `1px solid rgba(125, 249, 255, 0.3)`,
              pointerEvents: 'auto' // Make filters clickable
            }}>
              <SegmentButton
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                first
              >
                ALL
              </SegmentButton>
              <SegmentButton
                active={filter === 'request'}
                onClick={() => setFilter('request')}
              >
                REQ
              </SegmentButton>
              <SegmentButton
                active={filter === 'response'}
                onClick={() => setFilter('response')}
                last
              >
                RES
              </SegmentButton>
            </div>
          </div>
        </div>

        <MessageLog
          messages={allMessages}
          showDetailedView={true}
          maxHeight={800}
        />
      </div>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '8px 12px',
            marginTop: '8px',
            background: 'rgba(255, 78, 78, 0.1)',
            border: '1px solid rgba(255, 78, 78, 0.3)',
            borderRadius: '4px',
            color: colors.neonRed,
            fontSize: '12px'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            ERROR
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
            {error}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Helper component for segment buttons
function SegmentButton({
  active,
  onClick,
  children,
  first = false,
  last = false
}: {
  active: boolean,
  onClick: () => void,
  children: React.ReactNode,
  first?: boolean,
  last?: boolean
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        background: active ? `rgba(125, 249, 255, 0.15)` : 'transparent',
        borderLeft: first ? 'none' : '1px solid rgba(125, 249, 255, 0.3)',
        borderRight: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        padding: '3px 10px',
        color: active ? colors.cyber : colors.steel,
        fontFamily: 'monospace',
        fontSize: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
    >
      {active && (
        <motion.div
          layoutId="activeIndicator"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: colors.cyber,
            borderRadius: '1px'
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {children}
    </motion.button>
  );
}
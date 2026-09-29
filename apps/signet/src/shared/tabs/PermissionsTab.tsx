/**
 * PermissionsTab - Displays and manages all stored permissions
 * Shows permissions by domain, allows viewing details and revoking them
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors } from '~shared/styles/theme';
import { MessageType } from 'signet-sdk/src/messaging';
import { Storage } from '@plasmohq/storage';

// Initialize storage for permissions
const permissionsStorage = new Storage({ area: "local" })

// Permission data structure
interface PermissionData {
  allowed: boolean;
  timestamp: string;
}

// Stored permission with key information extracted
interface StoredPermission {
  key: string;
  origin: string;
  messageType: string;
  data: PermissionData;
  expirationDate: Date;
  isExpired: boolean;
  daysLeft: number;
}

// Helper function to extract parts from a permission key
function parsePermissionKey(key: string): { origin: string; messageType: string } | null {
  // Split by the first occurrence of "permission:" to handle origins with colons
  const prefix = "permission:";
  if (!key.startsWith(prefix)) {
    console.log("Key does not start with permission:", key);
    return null;
  }

  // Remove the prefix
  const remainder = key.substring(prefix.length);

  // Find the last colon to separate origin from messageType
  const lastColonIndex = remainder.lastIndexOf(':');
  if (lastColonIndex === -1) {
    console.log("No separator between origin and messageType:", remainder);
    return null;
  }

  // Extract origin and messageType
  const origin = remainder.substring(0, lastColonIndex);
  const messageType = remainder.substring(lastColonIndex + 1);

  if (!origin || !messageType) {
    console.log("Origin or messageType is empty:", { origin, messageType });
    return null;
  }

  const result = { origin, messageType };
  console.log("Successfully parsed:", result);
  return result;
}

// Format message type for display
function formatMessageType(type: string): string {
  // Convert snake_case to more readable format
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function PermissionsTab() {
  const [permissions, setPermissions] = useState<StoredPermission[]>([]);
  const [filter, setFilter] = useState<'all' | 'allowed' | 'denied'>('all');
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load permissions from storage
  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      // Get all stored items
      const items = await permissionsStorage.getAll();
      const currentTime = new Date().getTime();
      const maxPermissionAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

      // Filter and process permission items
      const permissionEntries: StoredPermission[] = Object.entries(items)
        // Only include items with keys that start with 'permission:'
        .filter(([key]) => key.startsWith('permission:'))
        .map(([key, value]) => {
          const parsedKey = parsePermissionKey(key);
          console.log(parsedKey)
          if (!parsedKey) return null;

          // Parse the data if it's a string
          let data: PermissionData;
          if (typeof value === 'string') {
            try {
              data = JSON.parse(value);
            } catch (e) {
              console.error(`Failed to parse permission value for ${key}:`, e);
              return null;
            }
          } else {
            data = value as unknown as PermissionData;
          }

          // Check that the data has the expected structure
          if (!data || typeof data.allowed !== 'boolean' || !data.timestamp) {
            console.error(`Invalid permission data format for ${key}:`, data);
            return null;
          }

          const permissionDate = new Date(data.timestamp).getTime();
          const expirationDate = new Date(permissionDate + maxPermissionAgeMs);
          const isExpired = currentTime > permissionDate + maxPermissionAgeMs;
          const daysLeft = Math.max(0, Math.floor((permissionDate + maxPermissionAgeMs - currentTime) / (24 * 60 * 60 * 1000)));

          return {
            key,
            origin: parsedKey.origin,
            messageType: parsedKey.messageType,
            data,
            expirationDate,
            isExpired,
            daysLeft
          };
        })
        .filter(Boolean) as StoredPermission[];

      setPermissions(permissionEntries);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load permissions on mount
  useEffect(() => {
    loadPermissions();
  }, []);

  // Apply filters
  const filteredPermissions = permissions.filter(permission => {
    if (filter === 'allowed') return permission.data.allowed;
    if (filter === 'denied') return !permission.data.allowed;
    return true;
  });

  // Get unique origins
  const origins = [...new Set(filteredPermissions.map(p => p.origin))];

  // Toggle origin expansion
  const toggleOrigin = (origin: string) => {
    setExpandedOrigins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(origin)) {
        newSet.delete(origin);
      } else {
        newSet.add(origin);
      }
      return newSet;
    });
  };

  // Remove a permission
  const removePermission = async (permission: StoredPermission) => {
    try {
      await permissionsStorage.remove(permission.key);
      await loadPermissions(); // Reload after deletion
    } catch (error) {
      console.error('Error removing permission:', error);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px'
      }}
    >
      {/* Header with filters */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(125, 249, 255, 0.2)'
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: '12px',
          color: colors.cyber,
          fontWeight: 'bold'
        }}>
          AUTHORIZATIONS
        </div>

        {/* Permission type filters */}
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
            {filteredPermissions.length} enabled
          </span>
          <div style={{
            display: 'flex',
            overflow: 'hidden',
            borderRadius: '4px',
            border: `1px solid rgba(125, 249, 255, 0.3)`,
          }}>
            <SegmentButton
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              first
            >
              ALL
            </SegmentButton>
            <SegmentButton
              active={filter === 'allowed'}
              onClick={() => setFilter('allowed')}
            >
              ALLOWED
            </SegmentButton>
            <SegmentButton
              active={filter === 'denied'}
              onClick={() => setFilter('denied')}
              last
            >
              DENIED
            </SegmentButton>
          </div>
        </div>
      </div>

      {/* Permissions list: the only part that scrolls */}
      <div className="signet-scrollbar" style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {isLoading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            color: colors.steel
          }}>
            <LoadingSpinner />
            <span style={{ marginLeft: '10px' }}>Loading permissions...</span>
          </div>
        ) : origins.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: colors.steel,
            fontSize: '14px',
            border: '1px dashed rgba(125, 249, 255, 0.2)',
            borderRadius: '4px',
            marginTop: '20px'
          }}>
            No permissions found
          </div>
        ) : (
          // Group permissions by origin
          origins.map(origin => {
            const originPermissions = filteredPermissions.filter(p => p.origin === origin);
            const isExpanded = expandedOrigins.has(origin);

            return (
              <div
                key={origin}
                style={{
                  border: '1px solid rgba(125, 249, 255, 0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                {/* Origin header */}
                <motion.div
                  onClick={() => toggleOrigin(origin)}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(125, 249, 255, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    borderBottom: isExpanded ? '1px solid rgba(125, 249, 255, 0.2)' : 'none'
                  }}
                  whileHover={{ background: 'rgba(125, 249, 255, 0.1)' }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: colors.white
                    }}>
                      {origin}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      background: 'rgba(125, 249, 255, 0.1)',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      color: colors.steel
                    }}>
                      {originPermissions.length}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '18px',
                    color: colors.steel,
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ›
                  </div>
                </motion.div>

                {/* Permission list for this origin */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {originPermissions.map(permission => (
                        <PermissionItem
                          key={permission.key}
                          permission={permission}
                          onRemove={removePermission}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Refresh button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={loadPermissions}
        style={{
          padding: '8px 12px',
          background: 'rgba(125, 249, 255, 0.1)',
          border: '1px solid rgba(125, 249, 255, 0.3)',
          borderRadius: '4px',
          color: colors.cyber,
          cursor: 'pointer',
          fontSize: '12px',
          textAlign: 'center',
          fontWeight: 'bold',
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <RefreshIcon /> REFRESH PERMISSIONS
      </motion.button>
    </div>
  );
}

// Individual permission item component
function PermissionItem({
  permission,
  onRemove
}: {
  permission: StoredPermission;
  onRemove: (permission: StoredPermission) => Promise<void>;
}) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(permission);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <motion.div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid rgba(125, 249, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        background: permission.data.allowed
          ? 'rgba(54, 199, 88, 0.05)'
          : 'rgba(255, 78, 78, 0.05)'
      }}
      whileHover={{
        background: permission.data.allowed
          ? 'rgba(54, 199, 88, 0.08)'
          : 'rgba(255, 78, 78, 0.08)'
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div style={{
          fontWeight: 'bold',
          color: colors.white
        }}>
          {formatMessageType(permission.messageType)}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: permission.data.allowed
              ? 'rgba(54, 199, 88, 0.1)'
              : 'rgba(255, 78, 78, 0.1)',
            color: permission.data.allowed
              ? colors.neonGreen
              : colors.neonRed,
          }}>
            {permission.data.allowed ? 'ALLOWED' : 'DENIED'}
          </div>
          <div style={{
            fontSize: '10px',
            color: colors.steel
          }}>
            {permission.isExpired
              ? 'Expired'
              : `Expires in ${permission.daysLeft} day${permission.daysLeft !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Actions */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleRemove}
        disabled={isRemoving}
        style={{
          background: 'rgba(255, 78, 78, 0.1)',
          border: '1px solid rgba(255, 78, 78, 0.3)',
          borderRadius: '4px',
          color: colors.neonRed,
          padding: '4px 8px',
          fontSize: '10px',
          cursor: isRemoving ? 'default' : 'pointer',
          opacity: isRemoving ? 0.5 : 1,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {isRemoving ? (
          <>
            <LoadingSpinner size={10} /> REMOVING...
          </>
        ) : (
          <>
            <TrashIcon /> REVOKE
          </>
        )}
      </motion.button>
    </motion.div>
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

// Loading spinner component
function LoadingSpinner({ size = 16 }: { size?: number }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid rgba(125, 249, 255, 0.1)`,
        borderTop: `2px solid rgba(125, 249, 255, 0.8)`,
        boxSizing: 'border-box'
      }}
    />
  );
}

// Icon components
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 3V8H16" stroke="#7DF9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16V21H8" stroke="#7DF9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3.13C14.4135 3.43459 12.9041 4.0469 11.5487 4.93248C10.1934 5.81807 9.02008 6.96034 8.10022 8.29977C7.18035 9.63921 6.54109 11.1475 6.2188 12.7366C5.89651 14.3257 5.89651 15.9675 6.2188 17.5565" stroke="#7DF9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 21.0001C9.5865 20.6955 11.0959 20.0832 12.4513 19.1976C13.8066 18.312 14.9799 17.1698 15.8998 15.8303C16.8197 14.4909 17.4589 12.9826 17.7812 11.3935C18.1035 9.80448 18.1035 8.16274 17.7812 6.57364" stroke="#7DF9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6H5H21" stroke="#FF4E4E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="#FF4E4E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
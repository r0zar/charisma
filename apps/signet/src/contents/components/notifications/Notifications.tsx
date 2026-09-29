import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSignetContext } from '~shared/context/SignetContext';
import NotificationPanel from '~shared/notifications/NotificationPanel';
import { RememberChoiceCheckbox } from './UIComponents';
import { NotificationFactory } from './NotificationFactory';

/**
 * Component that shows permission notifications to the user
 */
export const Notifications: React.FC = () => {
  const {
    pendingPermissions,
    approvePermission,
    denyPermission,
    rememberPermission
  } = useSignetContext();

  // Component state
  const [activePermission, setActivePermission] = useState<any>(null);
  const [rememberChoice, setRememberChoice] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Listen for pending permissions and show them
  useEffect(() => {
    // Don't show a new permission if we're already showing one or processing one
    if (activePermission || isProcessing) return;

    // Show the first pending permission if available
    if (pendingPermissions.length > 0) {
      console.log('Setting active permission:', pendingPermissions[0]);
      setActivePermission(pendingPermissions[0]);
    }
  }, [pendingPermissions, activePermission, isProcessing]);

  // Handle approval of permission request
  const handlePermissionApprove = () => {
    console.log('Approving permission:', activePermission);
    if (!activePermission) return;

    // Mark as processing to prevent showing another permission immediately
    setIsProcessing(true);

    // Process the permission
    if (rememberChoice) {
      rememberPermission(activePermission.id, true);
    } else {
      approvePermission(activePermission.id);
    }

    // Reset state
    setActivePermission(null);
    setRememberChoice(false);

    // Allow processing new permissions after a small delay
    setTimeout(() => {
      setIsProcessing(false);
    }, 500);
  };

  // Handle denial of permission request
  const handlePermissionDeny = () => {
    if (!activePermission) return;

    // Mark as processing to prevent showing another permission immediately
    setIsProcessing(true);

    // Process the permission
    if (rememberChoice) {
      rememberPermission(activePermission.id, false);
    } else {
      denyPermission(activePermission.id);
    }

    // Reset state
    setActivePermission(null);
    setRememberChoice(false);

    // Allow processing new permissions after a small delay
    setTimeout(() => {
      setIsProcessing(false);
    }, 500);
  };

  // Render remember choice checkbox with state
  const renderRememberChoice = () => (
    <RememberChoiceCheckbox
      checked={rememberChoice}
      onChange={() => setRememberChoice(!rememberChoice)}
    />
  );

  return (
    <div className="signet-notifications" style={{ pointerEvents: 'none' }}>
      <AnimatePresence>
        {activePermission && (
          <NotificationPanel
            notification={NotificationFactory.createPermissionNotification(
              activePermission,
              renderRememberChoice()
            )}
            onDismiss={handlePermissionDeny}
            onApprove={handlePermissionApprove}
            onReject={handlePermissionDeny}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
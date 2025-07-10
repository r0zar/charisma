import { type NotificationState } from '@/schemas/notification.schema';

/**
 * Notifications data
 */
export const notificationsData: NotificationState[] = [
  {
    id: "notification-151840",
    type: "info",
    title: "Price alert triggered",
    message: "STX price increased by 15% in last hour",
    timestamp: "2025-07-09T08:15:36.945Z",
    read: true,
    persistent: false
  },
  {
    id: "notification-312164",
    type: "error",
    title: "Contract call failed",
    message: "Smart contract rejected the transaction",
    timestamp: "2025-07-08T16:55:36.945Z",
    read: false,
    persistent: false
  },
  {
    id: "notification-387202",
    type: "warning",
    title: "Gas price elevated",
    message: "Network gas prices are 50% above normal",
    timestamp: "2025-07-08T12:22:36.945Z",
    read: true,
    persistent: false
  },
  {
    id: "notification-466562",
    type: "success",
    title: "Trade executed",
    message: "Successfully swapped 100 STX for ALEX",
    timestamp: "2025-07-08T06:27:36.945Z",
    read: false,
    persistent: false
  },
  {
    id: "notification-583159",
    type: "warning",
    title: "Bot performance",
    message: "Your bot has not made a profit in 24 hours",
    timestamp: "2025-07-07T21:50:36.945Z",
    read: true,
    persistent: false
  }
];
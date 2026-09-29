import { MessageType } from 'signet-sdk/src/messaging';
import type { ReactNode } from 'react';
import type { DexterityRoute } from 'signet-sdk/src/index';

/**
 * Permission level for notifications
 */
export enum PermissionLevel {
  INFO = 'info',
  SENSITIVE = 'sensitive',
  CRITICAL = 'critical'
}

/**
 * Banner type for origin banners
 */
export enum BannerType {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * Properties for notification actions (buttons)
 */
export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  color: string;
}

/**
 * Properties for a formatted notification
 */
export interface FormattedNotification {
  title: string;
  type: string;
  color: string;
  customIcon: ReactNode;
  message: ReactNode;
  actions: NotificationAction[];
}

/**
 * Common props for permission content components
 */
export interface PermissionContentProps {
  origin: string;
  rememberCheckbox: ReactNode;
}

/**
 * Props for default permission content
 */
export interface DefaultPermissionContentProps extends PermissionContentProps {
  type: string;
}

/**
 * Props for swap permission content
 */
export interface SwapPermissionContentProps extends PermissionContentProps {
  route: DexterityRoute;
  amount: number;
  options?: {
    disablePostConditions?: boolean;
    sponsored?: boolean;
    [key: string]: any;
  };
}

/**
 * Permissions request object
 */
export interface PermissionRequest {
  id: string;
  origin: string;
  type: MessageType;
  timestamp: string;
  message: any;
  data?: any
}
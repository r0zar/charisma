/**
 * Notifications Component
 * 
 * Responsible for displaying notifications based on messages from the SignetContext
 * This component handles the display, animation, and dismissal of notifications
 * as well as permission requests from web applications
 * 
 * Key features:
 * - Uses a React component for the "Remember this decision" checkbox
 * - Directly updates state through useState instead of custom events
 * - Handles permission approvals and denials with rememberChoice flag
 * 
 * This file is now a re-export of the refactored Notifications component
 */

import { Notifications } from './notifications';

// Re-export the Notifications component
export { Notifications };
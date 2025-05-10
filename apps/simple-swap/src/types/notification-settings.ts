export interface ChannelSpecificPreference {
    enabled: boolean;
    recipientId?: string; // e.g., Telegram Chat ID, Discord User/Channel ID, E.164 Phone Number
}

export interface OrderExecutedPreferences {
    telegram?: ChannelSpecificPreference;
    discord?: ChannelSpecificPreference;
    sms?: ChannelSpecificPreference;
    // We can add a general 'enabled' here if we want an overall toggle for this notification type
    // in addition to per-channel toggles, but for now, channel-specific is enough.
}

// Example for another notification type in the future
// export interface PriceAlertPreferences {
//   email?: ChannelSpecificPreference;
//   pushNotification?: ChannelSpecificPreference;
// }

export interface UserNotificationSettings {
    orderExecuted?: OrderExecutedPreferences;
    // Add other notification types here, e.g.:
    // priceAlerts?: PriceAlertPreferences;
} 
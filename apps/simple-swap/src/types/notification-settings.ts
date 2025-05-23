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

export interface BidEventPreferences {
    telegram?: ChannelSpecificPreference;
    discord?: ChannelSpecificPreference;
    sms?: ChannelSpecificPreference;
}

export interface OfferEventPreferences {
    telegram?: ChannelSpecificPreference;
    discord?: ChannelSpecificPreference;
    sms?: ChannelSpecificPreference;
}

// Example for another notification type in the future
// export interface PriceAlertPreferences {
//   email?: ChannelSpecificPreference;
//   pushNotification?: ChannelSpecificPreference;
// }

export interface UserNotificationSettings {
    orderExecuted?: OrderExecutedPreferences;
    bidReceived?: BidEventPreferences;      // When someone places a bid on your offer
    bidAccepted?: BidEventPreferences;      // When your bid gets accepted
    bidCancelled?: BidEventPreferences;     // When a bid on your offer gets cancelled
    offerFilled?: OfferEventPreferences;    // When an offer you're watching gets filled
    offerCancelled?: OfferEventPreferences; // When an offer you're watching gets cancelled
    // Add other notification types here, e.g.:
    // priceAlerts?: PriceAlertPreferences;
} 
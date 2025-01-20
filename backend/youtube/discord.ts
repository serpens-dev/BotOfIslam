import { api } from "encore.dev/api";
import { WebSubNotification } from "./types";

// Configuration for Discord webhook
let discordChannelId: string | null = null;

// Set Discord channel for notifications
export const setNotificationChannel = api({
    method: "POST"
}, async (params: { channelId: string }): Promise<void> => {
    discordChannelId = params.channelId;
});

// Get current Discord channel
export const getNotificationChannel = api({
    method: "GET"
}, async (): Promise<string | null> => {
    return discordChannelId;
});

// Send notification to Discord
export const sendNotification = api({
    method: "POST"
}, async (params: { notification: WebSubNotification }): Promise<void> => {
    if (!discordChannelId) {
        throw new Error("Discord channel not configured");
    }

    // TODO: Send to Discord channel
    const message = {
        content: `🎥 **Neues Video von ${params.notification.author}**\n${params.notification.title}\n${params.notification.link}`,
        allowed_mentions: {
            parse: ["users"]
        }
    };

    // TODO: Implement Discord webhook call
}); 
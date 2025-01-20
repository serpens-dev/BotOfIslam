import { api } from "encore.dev/api";
import { WebSubNotification } from "./types";
import { secret } from "encore.dev/config";

// Configuration
const DISCORD_WEBHOOK_URL = secret("DISCORD_WEBHOOK_URL");
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
    if (!DISCORD_WEBHOOK_URL()) {
        throw new Error("Discord webhook URL nicht konfiguriert");
    }

    const { notification } = params;
    
    // Erstelle eine schöne Embed-Nachricht
    const embed = {
        title: notification.title,
        url: notification.link,
        color: 0xFF0000, // YouTube Rot
        author: {
            name: notification.author,
            icon_url: `https://www.youtube.com/channel/${notification.feed.split(":").pop()}/avatar`,
        },
        thumbnail: {
            url: `https://img.youtube.com/vi/${notification.videoId}/maxresdefault.jpg`
        },
        timestamp: notification.published.toISOString()
    };

    const message = {
        content: `🎥 **Neues Video von ${notification.author}**`,
        embeds: [embed],
        allowed_mentions: {
            parse: ["users"]
        }
    };

    // Sende an Discord Webhook
    const response = await fetch(DISCORD_WEBHOOK_URL(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(message)
    });

    if (!response.ok) {
        throw new Error("Fehler beim Senden der Discord-Benachrichtigung");
    }
});
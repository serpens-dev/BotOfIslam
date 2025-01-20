import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { db } from "./utils/db";
import { YouTubeChannel, ChannelSubscription, NotificationSettings, WebSubNotification } from "./types";
import { XMLParser } from "fast-xml-parser";

const youtubeApiKey = secret("YOUTUBE_API_KEY");
const xmlParser = new XMLParser();

// WebSub callback endpoint
export const websubCallback = api.raw(
    { method: "POST", path: "/youtube/websub/callback", expose: true },
    async (req, res) => {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const body = Buffer.concat(chunks).toString();
        const notification = parseXml<WebSubNotification>(body);

        if (!notification?.feed?.entry?.length) {
            res.writeHead(400);
            res.end("Invalid notification");
            return;
        }

        const entry = notification.feed.entry[0];
        const channelId = entry["yt:channelId"];
        const videoId = entry["yt:videoId"];
        const videoTitle = entry.title;

        // Get channel information
        const channel = await db.queryRow<YouTubeChannel>`
            SELECT * FROM youtube_channels WHERE channel_id = ${channelId}
        `;

        if (!channel) {
            res.writeHead(404);
            res.end("Channel not found");
            return;
        }

        // Get subscriptions for this channel
        const subscriptions = [];
        const subsQuery = await db.query<ChannelSubscription>`
            SELECT * FROM channel_subscriptions WHERE channel_id = ${channel.id}
        `;
        for await (const sub of subsQuery) {
            subscriptions.push(sub);
        }

        // Get notification settings
        const settings = await db.queryRow<NotificationSettings>`
            SELECT * FROM notification_settings LIMIT 1
        `;

        if (!settings) {
            res.writeHead(500);
            res.end("Notification settings not found");
            return;
        }

        // Send Discord notification
        const mentions = subscriptions.map(sub => `<@${sub.discordUserId}>`).join(" ");
        const message = `🎥 Neues Video von ${channel.channelName}!\n${mentions}\n${videoTitle}\nhttps://www.youtube.com/watch?v=${videoId}`;

        await fetch(`https://discord.com/api/v10/channels/${settings.channelId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            },
            body: JSON.stringify({ content: message }),
        });

        res.writeHead(200);
        res.end("OK");
    }
);

// Subscribe to a channel
export const subscribeToChannel = api(
    { method: "POST" },
    async ({ channelId, channelName, discordUserId }: { 
        channelId: string;
        channelName: string;
        discordUserId: string;
    }) => {
        // Check if channel exists
        let channel = await db.queryRow<YouTubeChannel>`
            SELECT * FROM youtube_channels WHERE channel_id = ${channelId}
        `;

        // If not, create it
        if (!channel) {
            const result = await db.queryRow<YouTubeChannel>`
                INSERT INTO youtube_channels (channel_id, channel_name)
                VALUES (${channelId}, ${channelName})
                RETURNING *
            `;
            if (!result) {
                throw new Error("Failed to create channel");
            }
            channel = result;

            // Subscribe to WebSub
            await subscribeToWebSub(channelId);
        }

        // Create subscription
        await db.exec`
            INSERT INTO channel_subscriptions (channel_id, discord_user_id)
            VALUES (${channel.id}, ${discordUserId})
            ON CONFLICT DO NOTHING
        `;

        return { success: true };
    }
);

// Update notification settings
export const updateNotificationSettings = api(
    { method: "POST" },
    async ({ guildId, channelId }: { guildId: string; channelId: string }) => {
        await db.exec`
            INSERT INTO notification_settings (guild_id, channel_id)
            VALUES (${guildId}, ${channelId})
            ON CONFLICT (guild_id) DO UPDATE
            SET channel_id = ${channelId}
        `;

        return { success: true };
    }
);

// Helper function to subscribe to WebSub
async function subscribeToWebSub(channelId: string) {
    const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
    const callback = `${process.env.PUBLIC_URL}/youtube/websub/callback`;

    await fetch("https://pubsubhubbub.appspot.com/subscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            "hub.mode": "subscribe",
            "hub.topic": topic,
            "hub.callback": callback,
            "hub.verify": "async",
        }),
    });
}

// Helper function to parse XML
function parseXml<T>(xml: string): T {
    return xmlParser.parse(xml) as T;
} 
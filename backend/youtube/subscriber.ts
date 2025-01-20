import { api } from "encore.dev/api";
import { WebSubNotification } from "./types";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { Query } from "encore.dev/api";
import * as subscriptions from "./subscriptions";
import * as discord from "./discord";

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
});

interface VerifyParams {
    channelId: string;
    mode: Query<string>;
    topic: Query<string>;
    challenge: Query<string>;
    lease_seconds: Query<string>;
}

// WebSub Verification Endpoint
export const verify = api({
    method: "GET",
    path: "/youtube/webhook/:channelId",
    expose: true
}, async ({ channelId, mode, topic, challenge }: VerifyParams): Promise<string> => {
    // Verify the subscription
    if (mode === "subscribe") {
        const subscription = await subscriptions.getSubscription(channelId);
        
        // Verify topic matches our subscription
        if (subscription && subscription.topic === topic) {
            return challenge;
        }
    }
    return "";
});

// WebSub Notification Endpoint
export const notify = api.raw({
    method: "POST",
    path: "/youtube/webhook/:channelId",
    expose: true
}, async (req, res) => {
    const channelId = req.url?.split("/").pop();
    if (!channelId) {
        res.writeHead(400);
        res.end();
        return;
    }

    // Get subscription for verification
    const subscription = await subscriptions.getSubscription(channelId);
    if (!subscription) {
        res.writeHead(404);
        res.end();
        return;
    }

    // Read the raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Verify signature
    const signature = req.headers["x-hub-signature"];
    if (!subscriptions.verifySignature(body, signature?.toString(), subscription.secret)) {
        res.writeHead(403);
        res.end();
        return;
    }
    
    // Parse XML feed
    const feed = parser.parse(body.toString());
    const entry = feed.feed.entry;

    if (!entry) {
        res.writeHead(200);
        res.end();
        return;
    }

    const notification: WebSubNotification = {
        feed: feed.feed.id,
        title: entry.title,
        link: entry.link["@_href"],
        published: new Date(entry.published),
        author: entry.author.name,
        videoId: entry.videoId
    };

    // Send to Discord
    await discord.sendNotification({ notification });
    
    res.writeHead(200);
    res.end();
}); 
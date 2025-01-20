import { api } from "encore.dev/api";
import { WebSubNotification } from "./types";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { Query } from "encore.dev/api";

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
        // TODO: Verify channelId and topic match our subscription
        return challenge;
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
    const signature = req.headers["x-hub-signature"];
    
    // Read the raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // TODO: Verify signature with channel secret
    
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

    // TODO: Send to Discord
    
    res.writeHead(200);
    res.end();
}); 
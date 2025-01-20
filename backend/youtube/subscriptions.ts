import { api } from "encore.dev/api";
import { ChannelSubscription } from "./types";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const SUBSCRIPTIONS_FILE = path.join(__dirname, "subscriptions.json");
const HUB_URL = "https://pubsubhubbub.appspot.com/subscribe";
const LEASE_SECONDS = 86400; // 24 Stunden

// Helper function to read subscriptions
async function readSubscriptions(): Promise<ChannelSubscription[]> {
    try {
        const data = await fs.readFile(SUBSCRIPTIONS_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Helper function to write subscriptions
async function writeSubscriptions(subscriptions: ChannelSubscription[]): Promise<void> {
    await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
}

// Generate a secret for a channel
function generateSecret(channelId: string): string {
    return crypto.randomBytes(32).toString("hex");
}

// Subscribe to a channel's updates
export async function subscribe(channelId: string): Promise<void> {
    const subscriptions = await readSubscriptions();
    
    // Check if already subscribed
    if (subscriptions.some(s => s.channelId === channelId)) {
        return; // Already subscribed
    }

    const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
    const secret = generateSecret(channelId);
    const callbackUrl = `${process.env.ENCORE_APP_PUBLIC_URL}/youtube/webhook/${channelId}`;

    // Subscribe to WebSub hub
    const response = await fetch(HUB_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            "hub.callback": callbackUrl,
            "hub.mode": "subscribe",
            "hub.topic": topic,
            "hub.secret": secret,
            "hub.lease_seconds": LEASE_SECONDS.toString(),
            "hub.verify": "sync"
        })
    });

    if (!response.ok) {
        throw new Error("Fehler beim Abonnieren des Kanals");
    }

    // Save subscription
    const subscription: ChannelSubscription = {
        channelId,
        topic,
        secret,
        lease: new Date(Date.now() + LEASE_SECONDS * 1000)
    };

    subscriptions.push(subscription);
    await writeSubscriptions(subscriptions);
}

// Unsubscribe from a channel's updates
export async function unsubscribe(channelId: string): Promise<void> {
    const subscriptions = await readSubscriptions();
    const subscription = subscriptions.find(s => s.channelId === channelId);
    
    if (!subscription) {
        return; // Not subscribed
    }

    const callbackUrl = `${process.env.ENCORE_APP_PUBLIC_URL}/youtube/webhook/${channelId}`;

    // Unsubscribe from WebSub hub
    const response = await fetch(HUB_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            "hub.callback": callbackUrl,
            "hub.mode": "unsubscribe",
            "hub.topic": subscription.topic,
            "hub.verify": "sync"
        })
    });

    if (!response.ok) {
        throw new Error("Fehler beim Kündigen des Abonnements");
    }

    // Remove subscription
    const newSubscriptions = subscriptions.filter(s => s.channelId !== channelId);
    await writeSubscriptions(newSubscriptions);
}

// Get subscription for a channel
export async function getSubscription(channelId: string): Promise<ChannelSubscription | null> {
    const subscriptions = await readSubscriptions();
    return subscriptions.find(s => s.channelId === channelId) ?? null;
}

// Verify webhook signature
export function verifySignature(body: Buffer, signature: string | undefined, secret: string): boolean {
    if (!signature) return false;

    const expectedSignature = crypto
        .createHmac("sha1", secret)
        .update(body)
        .digest("hex");

    return `sha1=${expectedSignature}` === signature;
}

// Renew subscriptions that are about to expire
export const renewSubscriptions = api({
    method: "POST"
}, async (): Promise<void> => {
    const subscriptions = await readSubscriptions();
    const now = Date.now();
    
    // Renew subscriptions that expire in the next hour
    const renewalThreshold = now + 3600 * 1000;
    
    for (const subscription of subscriptions) {
        if (new Date(subscription.lease).getTime() < renewalThreshold) {
            await subscribe(subscription.channelId);
        }
    }
}); 
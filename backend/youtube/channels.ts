import { api } from "encore.dev/api";
import { YouTubeChannel } from "./types";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const CHANNELS_FILE = path.join(__dirname, "channels.json");

// Helper function to read channels
async function readChannels(): Promise<YouTubeChannel[]> {
    try {
        const data = await fs.readFile(CHANNELS_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Helper function to write channels
async function writeChannels(channels: YouTubeChannel[]): Promise<void> {
    await fs.writeFile(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

// Add a new channel
export const addChannel = api({
    method: "POST",
}, async (params: { channelId: string, name: string, url: string }): Promise<YouTubeChannel> => {
    const channels = await readChannels();
    
    // Check if channel already exists
    if (channels.some(c => c.id === params.channelId)) {
        throw new Error("Channel already exists");
    }

    const channel: YouTubeChannel = {
        id: params.channelId,
        name: params.name,
        url: params.url,
        addedAt: new Date()
    };

    channels.push(channel);
    await writeChannels(channels);

    // TODO: Subscribe to WebSub
    
    return channel;
});

// Remove a channel
export const removeChannel = api({
    method: "DELETE",
}, async (params: { channelId: string }): Promise<void> => {
    const channels = await readChannels();
    const newChannels = channels.filter(c => c.id !== params.channelId);
    
    if (channels.length === newChannels.length) {
        throw new Error("Channel not found");
    }

    await writeChannels(newChannels);
    
    // TODO: Unsubscribe from WebSub
});

// List all channels
export const listChannels = api({
    method: "GET",
}, async (): Promise<YouTubeChannel[]> => {
    return await readChannels();
}); 
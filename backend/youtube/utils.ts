import { secret } from "encore.dev/config";

const YOUTUBE_API_KEY = secret("YOUTUBE_API_KEY");

interface YouTubeChannelInfo {
    id: string;
    name: string;
    url: string;
}

/**
 * Extrahiert die Channel ID aus verschiedenen YouTube URL Formaten
 */
export function extractChannelId(url: string): string {
    const patterns = [
        /youtube\.com\/channel\/([^\/\?]+)/,  // /channel/UC...
        /youtube\.com\/c\/([^\/\?]+)/,        // /c/name
        /youtube\.com\/@([^\/\?]+)/,          // /@name
        /youtube\.com\/user\/([^\/\?]+)/      // /user/name (alt)
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    throw new Error("Ungültige YouTube-Kanal URL");
}

/**
 * Lädt Kanal-Informationen von der YouTube API
 */
export async function getChannelInfo(identifier: string): Promise<YouTubeChannelInfo> {
    // Bestimme den Suchparameter basierend auf der ID-Form
    const isCustomUrl = !identifier.startsWith("UC");
    const searchParam = isCustomUrl 
        ? `forUsername=${identifier}`
        : `id=${identifier}`;

    // API-Anfrage
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&${searchParam}&key=${YOUTUBE_API_KEY()}`,
        { method: "GET" }
    );

    if (!response.ok) {
        throw new Error("Fehler beim Laden der Kanal-Informationen");
    }

    const data = await response.json();
    
    if (!data.items?.[0]) {
        throw new Error("Kanal nicht gefunden");
    }

    const channel = data.items[0];
    return {
        id: channel.id,
        name: channel.snippet.title,
        url: `https://youtube.com/channel/${channel.id}`
    };
} 
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import log from 'encore.dev/log';
import { Channel } from './types';
import { getChannelInfo } from './api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHANNELS_FILE = path.join(__dirname, 'channels.json');
const HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
const CALLBACK_URL = 'https://serpens.dev/api/youtube/webhook';

interface ChannelStorage {
  channels: Channel[];
}

// WebSub Subscription Funktion
async function subscribeToChannel(channelId: string): Promise<void> {
  const formData = new URLSearchParams({
    'hub.callback': CALLBACK_URL,
    'hub.topic': `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
    'hub.verify': 'sync',
    'hub.mode': 'subscribe'
  });

  try {
    const response = await fetch(HUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`WebSub subscription failed: ${response.statusText}`);
    }

    log.info('Successfully subscribed to channel:', { channelId });
  } catch (error) {
    log.error('Error subscribing to channel:', { channelId, error });
    throw error;
  }
}

// WebSub Unsubscribe Funktion
async function unsubscribeFromChannel(channelId: string): Promise<void> {
  const formData = new URLSearchParams({
    'hub.callback': CALLBACK_URL,
    'hub.topic': `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
    'hub.verify': 'sync',
    'hub.mode': 'unsubscribe'
  });

  try {
    const response = await fetch(HUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`WebSub unsubscribe failed: ${response.statusText}`);
    }

    log.info('Successfully unsubscribed from channel:', { channelId });
  } catch (error) {
    log.error('Error unsubscribing from channel:', { channelId, error });
    throw error;
  }
}

// Lädt die Kanäle aus der JSON Datei
export async function loadChannels(): Promise<Channel[]> {
  try {
    const data = await fs.readFile(CHANNELS_FILE, 'utf-8');
    const storage: ChannelStorage = JSON.parse(data);
    return storage.channels;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Datei existiert nicht - erstelle sie
      await saveChannels([]);
      return [];
    }
    throw error;
  }
}

// Speichert die Kanäle in der JSON Datei
export async function saveChannels(channels: Channel[]): Promise<void> {
  const storage: ChannelStorage = { channels };
  await fs.writeFile(CHANNELS_FILE, JSON.stringify(storage, null, 2));
}

// Extrahiert die Channel ID aus einer YouTube URL
function extractChannelId(url: string): string {
  // Entferne Protokoll und www wenn vorhanden
  url = url.replace(/^(https?:\/\/)?(www\.)?/, '');
  
  // Verschiedene URL Formate
  const patterns = [
    // @username Format
    /youtube\.com\/@([^\/\?]+)/,
    // /channel/ID Format
    /youtube\.com\/channel\/([^\/\?]+)/,
    // /c/name Format
    /youtube\.com\/c\/([^\/\?]+)/,
    // /user/name Format
    /youtube\.com\/user\/([^\/\?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new Error('Ungültige YouTube Kanal URL. Unterstützte Formate:\n' +
    '- https://youtube.com/@username\n' +
    '- https://youtube.com/channel/ID\n' +
    '- https://youtube.com/c/name\n' +
    '- https://youtube.com/user/name');
}

// Fügt einen neuen Kanal hinzu
export async function addChannel(url: string): Promise<Channel> {
  const channels = await loadChannels();
  
  // Prüfe ob Kanal bereits existiert
  if (channels.some(c => c.url === url)) {
    throw new Error('Kanal bereits in der Überwachung');
  }

  // Hole Channel Info von der YouTube API
  const channelInfo = await getChannelInfo(url);
  
  const channel: Channel = {
    id: channelInfo.id,
    url: url,
    title: channelInfo.title,
    addedAt: new Date().toISOString(),
    addedBy: 'system'
  };

  // Erst zum WebSub Hub subscriben
  await subscribeToChannel(channelInfo.id);

  // Dann den Kanal speichern
  channels.push(channel);
  await saveChannels(channels);
  
  return channel;
}

// Entfernt einen Kanal
export async function removeChannel(url: string): Promise<void> {
  const channels = await loadChannels();
  const index = channels.findIndex(c => c.url === url);
  
  if (index === -1) {
    throw new Error('Kanal nicht gefunden');
  }

  const channelId = channels[index].id;

  // Erst vom WebSub Hub unsubscribe
  await unsubscribeFromChannel(channelId);
  
  channels.splice(index, 1);
  await saveChannels(channels);
}

// Aktualisiert einen Kanal
export async function updateChannel(channelId: string, updates: Partial<Channel>): Promise<void> {
  const channels = await loadChannels();
  const channel = channels.find(c => c.id === channelId);
  
  if (!channel) {
    throw new Error('Kanal nicht gefunden');
  }

  Object.assign(channel, updates);
  await saveChannels(channels);
} 
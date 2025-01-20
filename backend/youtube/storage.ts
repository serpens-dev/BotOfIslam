import { promises as fs } from 'fs';
import path from 'path';
import log from 'encore.dev/log';
import { Channel } from './types';

const CHANNELS_FILE = path.join(__dirname, 'channels.json');

interface ChannelStorage {
  channels: Channel[];
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
  const regex = /youtube\.com\/(channel|c|user)\/([^\/\?]+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error('Ungültige YouTube Kanal URL');
  }
  return match[2];
}

// Fügt einen neuen Kanal hinzu
export async function addChannel(url: string): Promise<Channel> {
  const channels = await loadChannels();
  const channelId = extractChannelId(url);

  // Prüfe ob Kanal bereits existiert
  if (channels.some(c => c.id === channelId)) {
    throw new Error('Kanal bereits in der Überwachung');
  }

  const channel: Channel = {
    id: channelId,
    url,
    title: url, // TODO: Hole den echten Kanalnamen von der YouTube API
    addedAt: new Date().toISOString(),
    addedBy: 'system'
  };

  channels.push(channel);
  await saveChannels(channels);
  
  // TODO: Subscribe zum WebSub Feed

  return channel;
}

// Entfernt einen Kanal
export async function removeChannel(channelId: string): Promise<void> {
  const channels = await loadChannels();
  const index = channels.findIndex(c => c.id === channelId);
  
  if (index === -1) {
    throw new Error('Kanal nicht gefunden');
  }

  // TODO: Unsubscribe vom WebSub Feed
  
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
import { api } from 'encore.dev/api';
import { secret } from 'encore.dev/config';
import log from 'encore.dev/log';
import { 
  AddChannelRequest, 
  AddChannelResponse, 
  RemoveChannelRequest, 
  ListChannelsResponse,
  WebSubVerification,
  FeedUpdate
} from './types';
import { loadChannels, saveChannels, addChannel, removeChannel } from './storage';
import { sendVideoNotification } from './notifications';
import { getDiscordClient } from '../discord/bot';
import { URL } from 'url';
import { google } from 'googleapis';

// Secrets
const WEBHOOK_SECRET = secret('YOUTUBE_WEBHOOK_SECRET');
const API_KEY = secret('YOUTUBE_API_KEY');

const youtube = google.youtube('v3');

export async function getChannelInfo(url: string) {
  try {
    // Extrahiere username/custom URL aus der vollen URL
    const username = url.split('/').pop()?.replace('@', '');
    if (!username) throw new Error('Konnte keinen Kanalnamen aus der URL extrahieren');

    log.info('Suche nach YouTube Kanal:', { username });
    
    // Suche nach dem Kanal
    const response = await youtube.search.list({
      key: API_KEY(),
      part: ['snippet'],
      q: username,
      type: ['channel'],
      maxResults: 1
    });

    log.info('YouTube API Antwort:', { 
      status: response.status,
      items: response.data.items?.length
    });

    const channel = response.data.items?.[0];
    if (!channel?.id?.channelId) {
      throw new Error('Kanal nicht gefunden');
    }

    return {
      id: channel.id.channelId,
      title: channel.snippet?.title || username
    };
  } catch (error: any) {
    log.error('Fehler beim Abrufen der Channel-Info:', error);
    
    // Detailliertere Fehlermeldung
    if (error.response?.data?.error?.message) {
      throw new Error(`YouTube API Fehler: ${error.response.data.error.message}`);
    }
    
    throw new Error('Kanal konnte nicht gefunden werden. Bitte überprüfe die URL.');
  }
}

// WebSub Endpoint
export const webhook = api.raw(
  { 
    expose: true,
    path: '/youtube/webhook',
    method: '*'
  },
  async (req, res) => {
    // WebSub Verifizierung
    if (req.method === 'GET') {
      const url = new URL(req.url || '', 'http://localhost');
      const rawParams = Object.fromEntries(url.searchParams);
      
      const params: WebSubVerification = {
        'hub.mode': rawParams['hub.mode'] as string,
        'hub.topic': rawParams['hub.topic'] as string,
        'hub.challenge': rawParams['hub.challenge'] as string,
        'hub.lease_seconds': rawParams['hub.lease_seconds']
      };
      
      if (params['hub.mode'] === 'subscribe' || params['hub.mode'] === 'unsubscribe') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(params['hub.challenge']);
        return;
      }
    }

    // Feed Updates
    if (req.method === 'POST') {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const data = Buffer.concat(chunks).toString();
        const feedUpdate = JSON.parse(data) as FeedUpdate;
        const client = getDiscordClient();
        
        if (client) {
          await sendVideoNotification(client, feedUpdate);
        }

        res.writeHead(200);
        res.end('OK');
      } catch (error) {
        log.error('Fehler beim Verarbeiten des Feed Updates:', error);
        res.writeHead(500);
        res.end('Error');
      }
    }
  }
);

// Management APIs
export const add = api(
  { method: 'POST' },
  async (req: AddChannelRequest): Promise<AddChannelResponse> => {
    const channel = await addChannel(req.url);
    return { channel };
  }
);

export const remove = api(
  { method: 'POST' },
  async (req: RemoveChannelRequest): Promise<void> => {
    await removeChannel(req.url);
  }
);

export const list = api(
  { method: 'GET' },
  async (): Promise<ListChannelsResponse> => {
    const channels = await loadChannels();
    return { channels };
  }
); 
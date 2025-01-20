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

// Webhook Secret für HMAC Validierung
const WEBHOOK_SECRET = secret('YOUTUBE_WEBHOOK_SECRET');

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
    await removeChannel(req.channelId);
  }
);

export const list = api(
  { method: 'GET' },
  async (): Promise<ListChannelsResponse> => {
    const channels = await loadChannels();
    return { channels };
  }
); 
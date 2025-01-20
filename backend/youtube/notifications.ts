import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { secret } from 'encore.dev/config';
import log from 'encore.dev/log';
import { FeedUpdate } from './types';

// Discord Channel ID für YouTube Benachrichtigungen
const YOUTUBE_NOTIFICATION_CHANNEL = secret('YOUTUBE_NOTIFICATION_CHANNEL');

export async function sendVideoNotification(
  client: Client,
  feedUpdate: FeedUpdate
) {
  try {
    if (!feedUpdate.feed.entry?.[0]) {
      return;
    }

    const video = feedUpdate.feed.entry[0];
    const channel = client.channels.cache.get(YOUTUBE_NOTIFICATION_CHANNEL()) as TextChannel;

    if (!channel) {
      log.error('YouTube Benachrichtigungskanal nicht gefunden!');
      return;
    }

    await channel.send({
      content: `Neues Video von **${video.author.name}**: ${video.id}`
    });

  } catch (error) {
    log.error('Fehler beim Senden der Video-Benachrichtigung:', error);
  }
} 
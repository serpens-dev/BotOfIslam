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
    const channel = client.channels.cache.get(YOUTUBE_NOTIFICATION_CHANNEL()) as TextChannel;

    if (!channel) {
      log.error('YouTube Benachrichtigungskanal nicht gefunden!');
      return;
    }

    // Erstelle einen schönen Embed für die Benachrichtigung
    const embed = new EmbedBuilder()
      .setColor('#FF0000') // YouTube Rot
      .setTitle(feedUpdate.title)
      .setDescription(feedUpdate.description)
      .setURL(`https://www.youtube.com/watch?v=${feedUpdate.videoId}`)
      .setTimestamp(new Date(feedUpdate.publishedAt))
      .setFooter({ text: 'YouTube Benachrichtigung' });

    await channel.send({
      content: `🎥 Neues Video verfügbar!`,
      embeds: [embed]
    });

  } catch (error) {
    log.error('Fehler beim Senden der Video-Benachrichtigung:', error);
  }
} 
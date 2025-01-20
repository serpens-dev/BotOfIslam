import { getDiscordClient } from '../discord/bot';
import { VoiceChannel, ChannelType } from 'discord.js';

export async function getVoiceChannel(channelId: string): Promise<VoiceChannel> {
  const client = getDiscordClient();
  if (!client) {
    throw new Error('Discord client is not initialized');
  }
  const channel = await client.channels.fetch(channelId);
  
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error('Channel not found or not a voice channel');
  }
  
  return channel as VoiceChannel;
} 
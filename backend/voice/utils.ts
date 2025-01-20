import { client } from '../discord/bot';
import { VoiceChannel, ChannelType } from 'discord.js';

export async function getVoiceChannel(channelId: string): Promise<VoiceChannel> {
  const channel = await client.channels.fetch(channelId);
  
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error('Kein gültiger Voice-Channel');
  }

  return channel as VoiceChannel;
} 
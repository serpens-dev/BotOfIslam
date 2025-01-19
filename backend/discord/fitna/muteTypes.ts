import { GuildMember } from 'discord.js';
import { SQLDatabase } from "encore.dev/storage/sqldb";
import log from "encore.dev/log";
import { db } from '../db';

export type MuteType = 'text_only' | 'emoji_only' | 'gif_only' | 'slow_mode' | 'voice_only';

export function getMuteTypeDisplay(type: MuteType): string {
  const displays = {
    'text_only': 'Nur Text',
    'emoji_only': 'Nur Emojis',
    'gif_only': 'Nur GIFs',
    'slow_mode': 'Slow Mode',
    'voice_only': 'Nur Voice'
  };
  return displays[type];
}

export async function getUserMuteType(userId: string): Promise<MuteType> {
  try {
    const pref = await db.queryRow<{preferred_mute_type: MuteType}>`
      SELECT preferred_mute_type FROM user_mute_preferences
      WHERE user_id = ${userId}
    `;
    return pref?.preferred_mute_type || 'text_only';
  } catch (error) {
    log.error("Fehler beim Abrufen der Mute-Präferenz", { error });
    return 'text_only';
  }
}

export async function applyMute(member: GuildMember, duration: number): Promise<void> {
  try {
    const muteType = await getUserMuteType(member.id);
    const channel = member.guild.channels.cache.find(ch => ch.name === 'mute-log');

    switch (muteType) {
      case 'text_only':
        // Nur Text erlauben, keine Medien
        await member.timeout(duration, 'Fitna Mute - Nur Text');
        await member.roles.add('text-only-role');
        break;

      case 'emoji_only':
        // Nur Emojis erlauben
        await member.timeout(duration, 'Fitna Mute - Nur Emojis');
        await member.roles.add('emoji-only-role');
        break;

      case 'gif_only':
        // Nur GIFs erlauben
        await member.timeout(duration, 'Fitna Mute - Nur GIFs');
        await member.roles.add('gif-only-role');
        break;

      case 'slow_mode':
        // Slow Mode (1 Nachricht pro Minute)
        await member.timeout(duration, 'Fitna Mute - Slow Mode');
        await member.roles.add('slow-mode-role');
        break;

      case 'voice_only':
        // Nur Voice Chat erlauben
        await member.timeout(duration, 'Fitna Mute - Nur Voice');
        await member.roles.add('voice-only-role');
        break;
    }

    if (channel?.isTextBased()) {
      await channel.send(
        `🔇 ${member.user.username} wurde für ${duration / (1000 * 60 * 60)} Stunden gemuted!\n` +
        `Mute-Art: ${getMuteTypeDisplay(muteType)}`
      );
    }

    log.info("User gemuted", { 
      userId: member.id, 
      muteType,
      duration 
    });
  } catch (error) {
    log.error("Fehler beim Muten des Users", { error });
    throw error;
  }
} 
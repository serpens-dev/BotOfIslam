import { VoiceChannel, Guild } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator } from '@discordjs/voice';
import log from "encore.dev/log";

interface RecordingSession {
  guildId: string;
  channelId: string;
  startTime: Date;
}

const activeRecordings = new Map<string, RecordingSession>();

export async function startRecording(voiceChannel: VoiceChannel): Promise<void> {
  try {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    activeRecordings.set(voiceChannel.guild.id, {
      guildId: voiceChannel.guild.id,
      channelId: voiceChannel.id,
      startTime: new Date(),
    });

    log.info("Aufnahme gestartet", { 
      channelId: voiceChannel.id, 
      guildId: voiceChannel.guild.id 
    });
  } catch (error) {
    log.error("Fehler beim Starten der Aufnahme", { error });
    throw error;
  }
}

export async function stopRecording(guildId: string): Promise<void> {
  try {
    const session = activeRecordings.get(guildId);
    if (!session) {
      throw new Error("Keine aktive Aufnahme gefunden");
    }

    // Hier können wir die Aufnahme speichern
    activeRecordings.delete(guildId);
    
    log.info("Aufnahme gestoppt", { guildId });
  } catch (error) {
    log.error("Fehler beim Stoppen der Aufnahme", { error });
    throw error;
  }
} 
import { 
  VoiceChannel, 
  TextChannel, 
  GuildMember, 
  ChannelType,
  VoiceState,
  Guild,
  Message
} from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnection,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  DiscordGatewayAdapterCreator
} from '@discordjs/voice';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import log from "encore.dev/log";
import { client } from '../discord/bot';
import { startAudioRecording, stopAudioRecording } from './audioRecorder';
import { startScreenRecording, stopScreenRecording } from './screenRecorder';
import { getStorage } from './storage';
import { createHighlightClips } from './clipGenerator';
import { VoiceDB } from './encore.service';
import { Recording, Highlight } from "./types";
import { getVoiceChannel as fetchVoiceChannel } from "./utils";

interface RecordingSession {
  id: number;                    // Datenbank ID als number
  channelId: string;
  startTime: Date;
  initiatorId: string;
  participants: Set<string>;
  audioFiles: string[];
  screenFiles: string[];
  highlights: Highlight[];
  screenRecordingEnabled: boolean;
  screenRecording: boolean;      // Aktiver Status
  lastConfirmation: Date;
  cloudLinks: {
    audio: string[];
    screen: string[];
  };
}

const activeRecordings = new Map<string, Recording>();

// Speichere die "Starte Aufnahme..." Nachrichten
const startMessages = new Map<string, Message>();

export async function startRecording(channelId: string, initiatorId: string): Promise<Recording> {
  try {
    log.info("Starte Aufnahmeprozess...");
    
    // Get voice channel
    const channel = await fetchVoiceChannel(channelId);
    if (!channel) {
      throw new Error("Voice Channel nicht gefunden");
    }
    log.info("Voice Channel gefunden", { channelId: channel.id, name: channel.name });

    // Sende initiale Nachricht
    const startMsg = await channel.send("Starte Aufnahme...");
    startMessages.set(channelId, startMsg);

    // Join voice channel
    log.info("Versuche dem Voice Channel beizutreten...");
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    if (!connection) {
      throw new Error("Konnte dem Voice Channel nicht beitreten");
    }
    log.info("Erfolgreich dem Voice Channel beigetreten");

    // Create new recording in database
    log.info("Erstelle Aufnahme in Datenbank...");
    const result = await VoiceDB.queryRow<{ id: number }>`
      INSERT INTO recordings (channel_id, initiator_id, started_at)
      VALUES (${channelId}, ${initiatorId}, NOW())
      RETURNING id
    `;

    if (!result) {
      throw new Error("Fehler beim Erstellen der Aufnahme");
    }
    log.info("Aufnahme in Datenbank erstellt", { recordingId: result.id });

    // Initialize recording session
    const recording: Recording = {
      id: result.id,
      channelId,
      initiatorId,
      startedAt: new Date(),
      screenRecording: false,
      audioFiles: [],
      screenFiles: [],
      cloudLinks: {
        audio: [],
        screen: []
      },
      lastConfirmation: new Date(),
      participants: [],
      highlights: [],
      startTime: new Date()
    };

    // Save to active recordings
    activeRecordings.set(channelId, recording);
    log.info("Recording-Session initialisiert");

    // Start audio recording
    log.info("Starte Audio-Aufnahme...");
    await startAudioRecording(connection, recording.id.toString());
    log.info("Audio-Aufnahme gestartet");

    // Update channel name to show recording status
    await channel.setName(`🎙️ ${channel.name}`);
    log.info("Channel-Name aktualisiert");

    // Update message after successful start
    await startMsg.edit("✅ Aufnahme läuft!");
    
    // Setup voice state update handler
    client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
      // Wenn es der Bot ist und er den Channel verlässt
      if (newState.member?.user.id === client.user?.id && oldState.channelId && !newState.channelId) {
        log.info("Bot hat den Voice Channel verlassen, beende Aufnahme...");
        try {
          await stopRecording(oldState.channelId);
        } catch (error) {
          log.error("Fehler beim automatischen Beenden der Aufnahme:", error);
        }
      }
    });

    return recording;
  } catch (error) {
    // If something goes wrong, clean up
    log.error("Fehler beim Starten der Aufnahme:", error);
    const connection = getVoiceConnection(channelId);
    if (connection) {
      connection.destroy();
      log.info("Voice-Verbindung getrennt nach Fehler");
    }
    // Lösche die Start-Nachricht bei Fehler
    const startMsg = startMessages.get(channelId);
    if (startMsg) {
      await startMsg.edit("❌ Fehler beim Starten der Aufnahme!");
      startMessages.delete(channelId);
    }
    activeRecordings.delete(channelId);
    throw error;
  }
}

export async function stopRecording(channelId: string): Promise<Recording> {
  const recording = activeRecordings.get(channelId);
  if (!recording) {
    throw new Error("Keine aktive Aufnahme in diesem Channel");
  }

  try {
    // Delete start message if it exists
    const startMsg = startMessages.get(channelId);
    if (startMsg) {
      await startMsg.delete().catch(() => {});
      startMessages.delete(channelId);
    }

    // Get voice channel for notifications
    const channel = await fetchVoiceChannel(channelId);
    if (!channel) {
      throw new Error("Voice Channel nicht gefunden");
    }

    // Update recording in database
    await VoiceDB.exec`
      UPDATE recordings 
      SET ended_at = NOW()
      WHERE id = ${recording.id}
    `;

    // Upload files and get links
    const storage = await getStorage();
    
    // Upload audio files and send links
    for (const file of recording.audioFiles) {
      const fileName = file.split('/').pop()!;
      const link = await storage.uploadFile(file, `audio/${fileName}`);
      recording.cloudLinks.audio.push(link);
    }

    // Upload screen recording files if any
    if (recording.screenRecording) {
      for (const file of recording.screenFiles) {
        const fileName = file.split('/').pop()!;
        const link = await storage.uploadFile(file, `screen/${fileName}`);
        recording.cloudLinks.screen.push(link);
      }
    }

    // Format links for Discord message
    let message = '⏹️ Aufnahme beendet!\n\n';
    
    if (recording.cloudLinks.audio.length > 0) {
      message += '🎙️ **Audio Aufnahmen:**\n';
      recording.cloudLinks.audio.forEach((link, index) => {
        message += `${index + 1}. ${link}\n`;
      });
    }

    if (recording.cloudLinks.screen.length > 0) {
      message += '\n🖥️ **Screen Aufnahmen:**\n';
      recording.cloudLinks.screen.forEach((link, index) => {
        message += `${index + 1}. ${link}\n`;
      });
    }

    // Send links in Discord
    await channel.send(message);

    // Set end time
    recording.endedAt = new Date();

    // Remove from active recordings
    activeRecordings.delete(channelId);

    return recording;
  } catch (error) {
    log.error("Fehler beim Stoppen der Aufnahme:", error);
    throw error;
  }
}

export async function toggleScreenRecording(channelId: string): Promise<boolean> {
  const session = activeRecordings.get(channelId);
  if (!session) {
    throw new Error("Keine aktive Aufnahme in diesem Channel");
  }

  session.screenRecording = !session.screenRecording;
  return session.screenRecording;
}

export async function addHighlight(channelId: string, description: string, userId: string): Promise<Highlight> {
  const recording = activeRecordings.get(channelId);
  if (!recording) {
    throw new Error("Keine aktive Aufnahme in diesem Channel");
  }

  try {
    // Create highlight in database
    const result = await VoiceDB.queryRow<{ id: number }>`
      INSERT INTO highlights (recording_id, description, user_id, timestamp)
      VALUES (${recording.id}, ${description}, ${userId}, NOW())
      RETURNING id, timestamp
    `;

    if (!result) {
      throw new Error("Fehler beim Erstellen des Highlights");
    }

    const createdHighlight: Highlight = {
      id: result.id,  // Direkt die number verwenden
      recordingId: recording.id,  // Direkt die number verwenden
      timestamp: new Date(),
      description,
      userId,
      clipPath: undefined
    };

    return createdHighlight;
  } catch (error) {
    log.error("Fehler beim Setzen des Highlights:", error);
    throw error;
  }
}

async function startConfirmationTimer(channel: VoiceChannel) {
  const interval = 15 * 60 * 1000; // 15 Minuten

  setInterval(async () => {
    const session = activeRecordings.get(channel.id);
    if (!session) return;

    // Prüfe ob seit der letzten Bestätigung 15 Minuten vergangen sind
    const timeSinceLastConfirmation = new Date().getTime() - session.lastConfirmation.getTime();
    if (timeSinceLastConfirmation >= interval) {
      try {
        // Frage nach Bestätigung
        const message = await channel.send({
          content: 'Die Aufnahme läuft seit 15 Minuten. Möchtest du fortfahren?',
          // Hier Buttons für Ja/Nein hinzufügen
        });

        // Warte 5 Minuten auf Antwort
        setTimeout(async () => {
          if (activeRecordings.has(channel.id)) {
            await stopRecording(channel.id);
            await channel.send('Aufnahme automatisch gestoppt (keine Bestätigung)');
          }
        }, 5 * 60 * 1000);
      } catch (error) {
        log.error('Fehler beim Senden der Bestätigung:', error);
      }
    }
  }, interval);
}

async function getVoiceChannel(channelId: string): Promise<VoiceChannel> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error('Channel nicht gefunden oder kein Voice Channel');
  }
  return channel as VoiceChannel;
} 
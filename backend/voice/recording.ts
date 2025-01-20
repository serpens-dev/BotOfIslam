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
import { getDiscordClient } from '../discord/bot';
import { startAudioRecording, stopAudioRecording } from './audioRecorder';
import { getStorage } from './storage';
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

// Initialisiere die Voice-Recording-Funktionalität
export async function initializeVoiceRecording() {
  const client = getDiscordClient();
  if (!client) {
    throw new Error('Discord client is not initialized');
  }

  client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    // Wenn es der Bot ist und er den Channel verlässt
    if (newState.member?.user.id === client.user?.id && oldState.channelId && !newState.channelId) {
      log.info("Bot hat den Voice Channel verlassen, beende Aufnahme...");
      try {
        const recording = activeRecordings.get(oldState.channelId);
        if (recording) {
          await stopRecording(oldState.channelId);
        }
      } catch (error) {
        log.error("Fehler beim automatischen Beenden der Aufnahme:", error);
      }
    }
  });

  log.info("Voice Recording System initialisiert");
}

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

    // Start confirmation timer
    startConfirmationTimer(channel);

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
    log.info("Stoppe Aufnahme...");

    // Get voice channel for notifications
    const channel = await fetchVoiceChannel(channelId);
    if (!channel) {
      throw new Error("Voice Channel nicht gefunden");
    }

    // Sende initiale Stopp-Nachricht
    const stopMsg = await channel.send("⏹️ Stoppe Aufnahme...");

    // Stoppe die Audio-Aufnahme
    const audioRecordingResult = await stopAudioRecording(channelId);
    log.info("Audio-Aufnahme gestoppt");

    // Delete start message if it exists
    const startMsg = startMessages.get(channelId);
    if (startMsg) {
      await startMsg.delete().catch(() => {});
      startMessages.delete(channelId);
    }

    // Update recording in database
    await VoiceDB.exec`
      UPDATE recordings 
      SET ended_at = NOW()
      WHERE id = ${recording.id}
    `;
    log.info("Datenbank aktualisiert");

    // Upload files and get links
    const storage = await getStorage();
    const uploadedLinks = {
      audio: [] as string[],
      screen: [] as string[]
    };
    
    // Aktualisiere die Stopp-Nachricht
    await stopMsg.edit("⏳ Lade Aufnahmen hoch...");
    
    // Upload audio files and send links
    if (audioRecordingResult && audioRecordingResult.audioFiles && audioRecordingResult.audioFiles.length > 0) {
      const { audioFiles } = audioRecordingResult;
      log.info("Starte Upload der Audiodateien...", { count: audioFiles.length });
      for (const file of audioFiles) {
        try {
          // Extrahiere nur den Dateinamen ohne Pfad
          const fileName = file.split(/[\\/]/).pop()!;
          const uploadPath = `audio/${fileName}`;
          const link = await storage.uploadFile(file, uploadPath);
          uploadedLinks.audio.push(link);
          log.info("Audiodatei hochgeladen", { file: fileName, link });
        } catch (error) {
          log.error("Fehler beim Upload der Audiodatei:", error);
        }
      }
    } else {
      log.warn("Keine Audiodateien zum Hochladen gefunden");
    }

    // Format links for Discord message
    let message = '⏹️ **Aufnahme beendet!**\n\n';
    
    if (uploadedLinks.audio.length > 0) {
      message += '🎙️ **Audio Aufnahmen:**\n';
      uploadedLinks.audio.forEach((link, index) => {
        message += `${index + 1}. ${link}\n`;
      });
    } else {
      message += '❌ Keine Audiodateien wurden aufgenommen oder hochgeladen.\n';
    }

    // Update final message
    await stopMsg.edit(message);
    log.info("Upload-Links gesendet");

    // Reset channel name
    await channel.setName(channel.name.replace('🎙️ ', ''));
    log.info("Channel-Name zurückgesetzt");

    // Set end time and update cloud links
    recording.endedAt = new Date();
    recording.cloudLinks = uploadedLinks;

    // Remove from active recordings
    activeRecordings.delete(channelId);
    log.info("Aufnahme erfolgreich beendet");

    return recording;
  } catch (error) {
    log.error("Fehler beim Stoppen der Aufnahme:", error);
    // Cleanup bei Fehler
    const connection = getVoiceConnection(channelId);
    if (connection) {
      connection.destroy();
      log.info("Voice-Verbindung nach Fehler getrennt");
    }
    activeRecordings.delete(channelId);
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
  const confirmationTimeout = 5 * 60 * 1000; // 5 Minuten Wartezeit für Bestätigung

  const timer = setInterval(async () => {
    const recording = activeRecordings.get(channel.id);
    if (!recording) {
      clearInterval(timer); // Timer stoppen wenn keine Aufnahme mehr aktiv
      return;
    }

    try {
      // Sende Bestätigungsnachricht
      const confirmMsg = await channel.send({
        content: '⚠️ **Aufnahme-Check**\nDie Aufnahme läuft seit 15 Minuten. Soll sie fortgesetzt werden?',
      });

      // Warte 5 Minuten auf Antwort
      setTimeout(async () => {
        const currentRecording = activeRecordings.get(channel.id);
        if (currentRecording && currentRecording.id === recording.id) {
          try {
            await stopRecording(channel.id);
            await channel.send('⏹️ Aufnahme wurde automatisch beendet (keine Bestätigung nach 5 Minuten).');
          } catch (error) {
            log.error('Fehler beim automatischen Stoppen der Aufnahme:', error);
          }
        }
        // Lösche die Bestätigungsnachricht
        await confirmMsg.delete().catch(() => {});
      }, confirmationTimeout);

    } catch (error) {
      log.error('Fehler beim Senden der Bestätigung:', error);
    }
  }, interval);

  // Speichere den Timer, um ihn später stoppen zu können
  return timer;
}

async function getVoiceChannel(channelId: string): Promise<VoiceChannel> {
  const client = getDiscordClient();
  if (!client) {
    throw new Error('Discord client is not initialized');
  }
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error('Channel nicht gefunden oder kein Voice Channel');
  }
  return channel as VoiceChannel;
} 
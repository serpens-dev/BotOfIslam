import { 
  VoiceChannel, 
  TextChannel, 
  GuildMember, 
  ChannelType,
  VoiceState
} from 'discord.js';
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

export async function startRecording(channelId: string, initiatorId: string): Promise<Recording> {
  try {
    // Create new recording in database
    const result = await VoiceDB.queryRow<{ id: number }>`
      INSERT INTO recordings (channel_id, initiator_id, started_at)
      VALUES (${channelId}, ${initiatorId}, NOW())
      RETURNING id
    `;

    if (!result) {
      throw new Error("Fehler beim Erstellen der Aufnahme");
    }

    // Initialize recording session
    const recording: Recording = {
      id: result.id,  // Direkt die number verwenden
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

    return recording;
  } catch (error) {
    log.error("Fehler beim Starten der Aufnahme:", error);
    throw error;
  }
}

export async function stopRecording(channelId: string): Promise<Recording> {
  const recording = activeRecordings.get(channelId);
  if (!recording) {
    throw new Error("Keine aktive Aufnahme in diesem Channel");
  }

  try {
    // Update recording in database
    await VoiceDB.exec`
      UPDATE recordings 
      SET ended_at = NOW()
      WHERE id = ${recording.id}  // number wird automatisch konvertiert
    `;

    // Upload files and get links
    const storage = await getStorage();
    
    // Upload audio files
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
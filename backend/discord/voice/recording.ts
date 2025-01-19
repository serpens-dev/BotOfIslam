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
import { client } from '../bot';
import { startAudioRecording, stopAudioRecording } from './audioRecorder';
import { startScreenRecording, stopScreenRecording } from './screenRecorder';

interface RecordingSession {
  channelId: string;
  participants: Set<string>; // User IDs
  startTime: Date;
  filePath: string;
  screenRecording: boolean;
  highlights: Highlight[];
  lastConfirmation: Date;
  audioFiles: string[];
  screenFiles: string[];
}

interface Highlight {
  timestamp: Date;
  description: string;
  clipPath?: string; // Optional, wenn ein Clip erstellt wurde
  createdBy: string; // User ID
}

const activeRecordings = new Map<string, RecordingSession>();

export async function startRecording(
  voiceChannel: VoiceChannel,
  initiator: GuildMember,
  participants?: string[]
) {
  try {
    // Prüfe ob bereits eine Aufnahme läuft
    if (activeRecordings.has(voiceChannel.id)) {
      throw new Error('Es läuft bereits eine Aufnahme in diesem Channel');
    }

    // Setze Channel Name
    const originalName = voiceChannel.name;
    await voiceChannel.setName(`🔴 ${originalName}`);

    // Starte Audio Aufnahme
    await startAudioRecording(voiceChannel, participants);

    // Erstelle neue Recording Session
    const session: RecordingSession = {
      channelId: voiceChannel.id,
      participants: new Set(participants || []),
      startTime: new Date(),
      filePath: `recordings/${voiceChannel.id}_${Date.now()}.webm`,
      screenRecording: false,
      highlights: [],
      lastConfirmation: new Date(),
      audioFiles: [],
      screenFiles: []
    };

    activeRecordings.set(voiceChannel.id, session);

    // Starte Confirmation Timer
    startConfirmationTimer(voiceChannel);

    log.info('Aufnahme gestartet', {
      channel: voiceChannel.name,
      initiator: initiator.user.tag
    });

    return session;
  } catch (error) {
    log.error('Fehler beim Starten der Aufnahme:', error);
    throw error;
  }
}

export async function stopRecording(channelId: string) {
  const session = activeRecordings.get(channelId);
  if (!session) {
    throw new Error('Keine aktive Aufnahme in diesem Channel');
  }

  try {
    const channel = await getVoiceChannel(channelId);
    
    // Stoppe Audio Aufnahme
    const audioFiles = await stopAudioRecording(channelId);
    session.audioFiles = audioFiles;

    // Stoppe Screen Recordings falls aktiv
    if (session.screenRecording) {
      for (const participant of session.participants) {
        const screenFile = await stopScreenRecording(participant);
        if (screenFile) {
          session.screenFiles.push(screenFile);
        }
      }
    }

    // Entferne Aufnahme-Emoji vom Channel Namen
    await channel.setName(channel.name.replace('🔴 ', ''));
    
    // Cleanup
    activeRecordings.delete(channelId);

    log.info('Aufnahme gestoppt', {
      channel: channel.name,
      duration: new Date().getTime() - session.startTime.getTime(),
      audioFiles: session.audioFiles,
      screenFiles: session.screenFiles
    });

    return session;
  } catch (error) {
    log.error('Fehler beim Stoppen der Aufnahme:', error);
    throw error;
  }
}

export async function toggleScreenRecording(channelId: string) {
  const session = activeRecordings.get(channelId);
  if (!session) {
    throw new Error('Keine aktive Aufnahme in diesem Channel');
  }

  try {
    if (!session.screenRecording) {
      // Starte Screen Recording für alle Teilnehmer
      for (const participant of session.participants) {
        await startScreenRecording(channelId, participant, `https://discord.com/channels/${channelId}/${participant}`);
      }
      session.screenRecording = true;
    } else {
      // Stoppe Screen Recording für alle Teilnehmer
      for (const participant of session.participants) {
        const screenFile = await stopScreenRecording(participant);
        if (screenFile) {
          session.screenFiles.push(screenFile);
        }
      }
      session.screenRecording = false;
    }
    return session.screenRecording;
  } catch (error) {
    log.error('Fehler beim Ändern des Screen Recordings:', error);
    throw error;
  }
}

export async function addHighlight(
  channelId: string,
  description: string,
  userId: string
) {
  const session = activeRecordings.get(channelId);
  if (!session) {
    throw new Error('Keine aktive Aufnahme in diesem Channel');
  }

  const highlight: Highlight = {
    timestamp: new Date(),
    description,
    createdBy: userId
  };

  session.highlights.push(highlight);
  return highlight;
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
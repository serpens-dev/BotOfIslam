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
import { getStorage } from '../storage/megaStorage';
import { createHighlightClips } from './clipGenerator';
import { VoiceDB } from './encore.service';

interface RecordingSession {
  id: number; // Datenbank ID
  channelId: string;
  participants: Set<string>; // User IDs
  startTime: Date;
  filePath: string;
  screenRecording: boolean;
  highlights: Highlight[];
  lastConfirmation: Date;
  audioFiles: string[];
  screenFiles: string[];
  cloudLinks: {
    audio: string[];
    screen: string[];
  };
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

    // Erstelle Aufnahme in der Datenbank
    const row = await VoiceDB.queryRow<{ id: number }>`
      INSERT INTO recordings (
        channel_id,
        started_at,
        initiator_id,
        screen_recording
      ) VALUES (
        ${voiceChannel.id},
        NOW(),
        ${initiator.id},
        false
      )
      RETURNING id
    `;

    if (!row?.id) {
      throw new Error('Fehler beim Erstellen der Aufnahme in der Datenbank');
    }

    // Füge Teilnehmer zur Datenbank hinzu
    const participantIds = participants || [];
    for (const userId of participantIds) {
      await VoiceDB.exec`
        INSERT INTO recording_participants (
          recording_id,
          user_id
        ) VALUES (
          ${row.id},
          ${userId}
        )
      `;
    }

    // Setze Channel Name
    const originalName = voiceChannel.name;
    await voiceChannel.setName(`🔴 ${originalName}`);

    // Starte Audio Aufnahme
    await startAudioRecording(voiceChannel, participants);

    // Erstelle neue Recording Session
    const session: RecordingSession = {
      id: row.id,
      channelId: voiceChannel.id,
      participants: new Set(participantIds),
      startTime: new Date(),
      filePath: `recordings/${voiceChannel.id}_${Date.now()}.webm`,
      screenRecording: false,
      highlights: [],
      lastConfirmation: new Date(),
      audioFiles: [],
      screenFiles: [],
      cloudLinks: {
        audio: [],
        screen: []
      }
    };

    activeRecordings.set(voiceChannel.id, session);

    // Starte Confirmation Timer
    startConfirmationTimer(voiceChannel);

    log.info('Aufnahme gestartet', {
      channel: voiceChannel.name,
      initiator: initiator.user.tag,
      recordingId: session.id
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

    // Upload Dateien zu Mega
    const storage = getStorage();
    
    // Upload Audio Files
    for (const audioFile of session.audioFiles) {
      const fileName = audioFile.split('/').pop()!;
      const link = await storage.uploadFile(audioFile, `audio/${fileName}`);
      session.cloudLinks.audio.push(link);

      // Update Teilnehmer in der Datenbank
      await VoiceDB.exec`
        UPDATE recording_participants
        SET 
          audio_file_path = ${audioFile},
          cloud_audio_link = ${link}
        WHERE recording_id = ${session.id}
          AND user_id = ${fileName.split('_')[0]} -- User ID ist Teil des Dateinamens
      `;
    }

    // Upload Screen Files
    for (const screenFile of session.screenFiles) {
      const fileName = screenFile.split('/').pop()!;
      const link = await storage.uploadFile(screenFile, `screen/${fileName}`);
      session.cloudLinks.screen.push(link);

      // Update Teilnehmer in der Datenbank
      await VoiceDB.exec`
        UPDATE recording_participants
        SET 
          screen_file_path = ${screenFile},
          cloud_screen_link = ${link}
        WHERE recording_id = ${session.id}
          AND user_id = ${fileName.split('_')[0]} -- User ID ist Teil des Dateinamens
      `;
    }

    // Erstelle Highlight Clips falls vorhanden
    let highlightClips: Array<{ description: string; link: string }> = [];
    if (session.highlights.length > 0 && session.audioFiles.length > 0) {
      highlightClips = await createHighlightClips(
        session.audioFiles[0], // Nutze erste Audio Datei
        session.highlights,
        session.startTime
      );

      // Update Highlights in der Datenbank
      for (let i = 0; i < session.highlights.length; i++) {
        const highlight = session.highlights[i];
        const clip = highlightClips[i];

        if (clip) {
          await VoiceDB.exec`
            UPDATE highlights
            SET cloud_clip_link = ${clip.link}
            WHERE recording_id = ${session.id}
              AND created_by = ${highlight.createdBy}
              AND description = ${highlight.description}
          `;
        }
      }
    }

    // Update Aufnahme Status in der Datenbank
    await VoiceDB.exec`
      UPDATE recordings
      SET 
        ended_at = NOW(),
        screen_recording = ${session.screenRecording}
      WHERE id = ${session.id}
    `;

    // Entferne Aufnahme-Emoji vom Channel Namen
    await channel.setName(channel.name.replace('🔴 ', ''));
    
    // Sende Links in den Channel
    let message = '**Aufnahme beendet!**\n\n';
    
    if (session.cloudLinks.audio.length > 0) {
      message += '**Audio Aufnahmen:**\n';
      session.cloudLinks.audio.forEach((link, i) => {
        message += `${i + 1}. ${link}\n`;
      });
    }

    if (session.cloudLinks.screen.length > 0) {
      message += '\n**Screen Recordings:**\n';
      session.cloudLinks.screen.forEach((link, i) => {
        message += `${i + 1}. ${link}\n`;
      });
    }

    if (highlightClips.length > 0) {
      message += '\n**Highlight Clips:**\n';
      highlightClips.forEach((clip, i) => {
        message += `${i + 1}. ${clip.description}: ${clip.link}\n`;
      });
    }

    await channel.send(message);

    // Cleanup
    activeRecordings.delete(channelId);

    log.info('Aufnahme gestoppt', {
      channel: channel.name,
      duration: new Date().getTime() - session.startTime.getTime(),
      audioFiles: session.audioFiles,
      screenFiles: session.screenFiles,
      cloudLinks: session.cloudLinks,
      highlightClips,
      recordingId: session.id
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

    // Update Screen Recording Status in der Datenbank
    await VoiceDB.exec`
      UPDATE recordings
      SET screen_recording = ${session.screenRecording}
      WHERE id = ${session.id}
    `;

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

  // Füge Highlight zur Session hinzu
  session.highlights.push(highlight);

  // Speichere Highlight in der Datenbank
  await VoiceDB.exec`
    INSERT INTO highlights (
      recording_id,
      timestamp,
      description,
      created_by
    ) VALUES (
      ${session.id},
      ${highlight.timestamp},
      ${description},
      ${userId}
    )
  `;

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
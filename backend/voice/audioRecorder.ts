import { 
  VoiceConnection,
  EndBehaviorType,
  createAudioResource,
  createAudioPlayer,
  AudioReceiveStream,
  getVoiceConnection,
  VoiceReceiver,
  joinVoiceChannel
} from '@discordjs/voice';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { VoiceChannel, GuildMember } from 'discord.js';
import { mkdir } from 'fs/promises';
import log from "encore.dev/log";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getStorage } from './storage';
import { pipeline } from 'stream/promises';

// ES Module __dirname Workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const activeRecordings = new Map<string, {
  connection: VoiceConnection;
  stream: any;
  audioFiles: string[];
}>();

interface AudioRecording {
  audioFiles: string[];
}

export async function startAudioRecording(connection: VoiceConnection, recordingId: string) {
  try {
    const receiver = connection.receiver;
    const recordingsPath = join(process.cwd(), 'recordings', recordingId);
    
    // Prüfe ob channelId existiert
    const channelId = connection.joinConfig.channelId;
    if (!channelId) {
      throw new Error("Keine Channel ID in der Voice Connection gefunden");
    }
    
    // Create recordings directory
    await mkdir(recordingsPath, { recursive: true });
    log.info("Aufnahmeverzeichnis erstellt", { path: recordingsPath });

    // Speichere die aktive Aufnahme
    activeRecordings.set(channelId, {
      connection,
      stream: receiver,
      audioFiles: [] as string[]
    });

    log.info("Audio-Aufnahme initialisiert", { channelId });

    // Start recording for each speaking user
    connection.receiver.speaking.on('start', async (userId) => {
      log.info("Benutzer spricht", { userId });
      
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100
        }
      });

      const fileName = `${recordingId}_${userId}_${Date.now()}.webm`;
      const filePath = join(recordingsPath, fileName);
      const fileStream = createWriteStream(filePath);

      log.info("Neue Audiodatei erstellt", { fileName, filePath });

      try {
        // Convert AudioReceiveStream to Node.js Readable
        const nodeStream = Readable.from(audioStream as unknown as AsyncIterable<any>);
        
        // Speichere den Dateipfad
        const recording = activeRecordings.get(channelId);
        if (recording) {
          recording.audioFiles.push(filePath);
        }
        
        // Handle stream events
        nodeStream.on('data', (chunk) => {
          fileStream.write(chunk);
        });

        nodeStream.on('end', async () => {
          fileStream.end();
          log.info("Audioaufnahme gespeichert", { filePath });
        });

        // Handle errors
        nodeStream.on('error', (error) => {
          log.error("Fehler im Audio-Stream", { userId, error });
          fileStream.end();
        });

        fileStream.on('error', (error) => {
          log.error("Fehler beim Schreiben der Audiodatei", { userId, error });
        });

      } catch (error) {
        log.error("Fehler bei der Audioaufnahme", { userId, error });
      }
    });

    return true;
  } catch (error) {
    log.error("Fehler beim Starten der Audio-Aufnahme:", error);
    throw error;
  }
}

export async function stopAudioRecording(channelId: string): Promise<AudioRecording | null> {
  try {
    const recording = activeRecordings.get(channelId);
    if (!recording) {
      log.warn("Keine aktive Audio-Aufnahme gefunden", { channelId });
      return null;
    }

    // Stoppe die Aufnahme
    if (recording.connection) {
      // Entferne alle Listener
      recording.connection.receiver.speaking.removeAllListeners();
      
      // Trenne die Verbindung
      recording.connection.destroy();
      log.info("Voice-Verbindung getrennt");
    }
    
    // Speichere die Audiodateien
    const audioFiles = recording.audioFiles;
    
    // Entferne die Aufnahme aus der Map
    activeRecordings.delete(channelId);
    
    log.info("Audio-Aufnahme gestoppt", { channelId, fileCount: audioFiles.length });

    // Gebe die Audiodateien zurück
    return { audioFiles };
  } catch (error) {
    log.error("Fehler beim Stoppen der Audio-Aufnahme:", error);
    throw error;
  }
} 
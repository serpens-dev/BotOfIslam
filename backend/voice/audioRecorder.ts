import { 
  VoiceConnection,
  EndBehaviorType
} from '@discordjs/voice';
import { join } from 'path';
import { createWriteStream, WriteStream } from 'fs';
import { Readable } from 'stream';
import { mkdir } from 'fs/promises';
import log from "encore.dev/log";
import { finished } from 'stream/promises';
import { spawn } from 'child_process';

interface AudioRecording {
  audioFiles: string[];
}

// Aktive Aufnahmen mit ihren Streams
const activeRecordings = new Map<string, {
  connection: VoiceConnection;
  userStreams: Map<string, {
    stream: Readable;
    fileStream: WriteStream;
    filePath: string;
    ffmpeg: any;
  }>;
}>();

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

    // Initialisiere die Aufnahme-Session
    activeRecordings.set(channelId, {
      connection,
      userStreams: new Map()
    });

    log.info("Audio-Aufnahme initialisiert", { channelId });

    // Start recording for each speaking user
    connection.receiver.speaking.on('start', async (userId) => {
      try {
        const recording = activeRecordings.get(channelId);
        if (!recording) return;

        // Wenn der Benutzer bereits aufgenommen wird, ignorieren
        if (recording.userStreams.has(userId)) return;

        log.info("Benutzer beginnt zu sprechen", { userId });
        
        const audioStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.Manual
          }
        });

        const fileName = `${recordingId}_${userId}.mp3`;
        const filePath = join(recordingsPath, fileName);

        // FFmpeg Prozess für MP3-Konvertierung
        const ffmpeg = spawn('ffmpeg', [
          '-i', 'pipe:0',          // Input von pipe
          '-acodec', 'libmp3lame', // MP3 Codec
          '-ab', '128k',           // Bitrate
          '-ac', '2',              // Stereo
          '-ar', '48000',          // Sample rate
          '-f', 'mp3',             // Format
          filePath                 // Output file
        ]);

        // Convert AudioReceiveStream to Node.js Readable
        const nodeStream = Readable.from(audioStream as unknown as AsyncIterable<any>);
        
        // Fehlerbehandlung für Streams
        nodeStream.on('error', (error) => {
          log.error("Fehler im Audio-Stream", { userId, error });
          ffmpeg.kill();
        });

        ffmpeg.stderr.on('data', (data) => {
          log.debug("FFmpeg Output:", data.toString());
        });

        ffmpeg.on('error', (error) => {
          log.error("FFmpeg Fehler:", error);
        });

        ffmpeg.on('exit', (code, signal) => {
          if (code === 0) {
            log.info("FFmpeg Konvertierung erfolgreich beendet");
          } else {
            log.error("FFmpeg Prozess fehlgeschlagen", { code, signal });
          }
        });

        recording.userStreams.set(userId, {
          stream: nodeStream,
          fileStream: ffmpeg.stdin as unknown as WriteStream,
          filePath,
          ffmpeg
        });

        // Pipe stream to FFmpeg
        nodeStream.pipe(ffmpeg.stdin);
        
        // Warte auf Stream-Ende
        finished(nodeStream).catch((error) => {
          log.error("Stream wurde unerwartet beendet", { userId, error });
        });

        log.info("Neue Audioaufnahme gestartet", { userId, filePath });
      } catch (error) {
        log.error("Fehler beim Starten der Benutzer-Aufnahme", { userId, error });
      }
    });

    connection.receiver.speaking.on('end', (userId) => {
      const recording = activeRecordings.get(channelId);
      if (!recording) return;

      const userStream = recording.userStreams.get(userId);
      if (userStream) {
        log.info("Benutzer hat aufgehört zu sprechen", { userId });
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

    // Sammle alle Dateipfade
    const audioFiles: string[] = [];
    
    // Beende alle Streams sicher
    for (const [userId, userStream] of recording.userStreams) {
      try {
        // Beende Stream sicher
        userStream.stream.unpipe(userStream.fileStream);
        userStream.stream.destroy();
        
        // Beende FFmpeg sauber
        userStream.fileStream.end();
        
        // Warte auf FFmpeg Beendigung
        await new Promise<void>((resolve) => {
          userStream.ffmpeg.on('exit', () => {
            resolve();
          });
        });
        
        audioFiles.push(userStream.filePath);
        log.info("Audio-Stream beendet", { userId });
      } catch (error) {
        log.error("Fehler beim Beenden des Streams", { userId, error });
      }
    }

    // Entferne alle Listener
    recording.connection.receiver.speaking.removeAllListeners();
    
    // Trenne die Verbindung
    recording.connection.destroy();
    log.info("Voice-Verbindung getrennt");
    
    // Entferne die Aufnahme aus der Map
    activeRecordings.delete(channelId);
    
    log.info("Audio-Aufnahme gestoppt", { channelId, fileCount: audioFiles.length });

    return { audioFiles };
  } catch (error) {
    log.error("Fehler beim Stoppen der Audio-Aufnahme:", error);
    throw error;
  }
} 
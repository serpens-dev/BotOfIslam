import { 
  VoiceConnection,
  EndBehaviorType
} from '@discordjs/voice';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { Readable, PassThrough } from 'stream';
import { mkdir } from 'fs/promises';
import log from "encore.dev/log";
import { finished } from 'stream/promises';
import { spawn } from 'child_process';
import prism from 'prism-media';

// FFmpeg Pfad
const FFMPEG_PATH = 'C:\\ffmpeg\\bin\\ffmpeg.exe';

// Audio Konfiguration
const OPUS_SAMPLE_RATE = 48000;
const OPUS_CHANNELS = 2;
const OPUS_FRAME_SIZE = 960;

interface AudioRecording {
  audioFiles: string[];
}

// Aktive Aufnahmen mit ihren Streams
const activeRecordings = new Map<string, {
  connection: VoiceConnection;
  userStreams: Map<string, {
    stream: Readable;
    transcoder: prism.opus.Decoder;
    buffer: PassThrough;
    ffmpeg: any;
    filePath: string;
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
    log.info("🎙️ Aufnahmeverzeichnis erstellt", { path: recordingsPath });

    // Initialisiere die Aufnahme-Session
    activeRecordings.set(channelId, {
      connection,
      userStreams: new Map()
    });

    log.info("🎤 Audio-System bereit und wartet auf Sprecher", { channelId });

    // Start recording for each speaking user
    connection.receiver.speaking.on('start', async (userId) => {
      try {
        const recording = activeRecordings.get(channelId);
        if (!recording) return;

        // Wenn der Benutzer bereits aufgenommen wird, ignorieren
        if (recording.userStreams.has(userId)) {
          log.debug("👥 Benutzer wird bereits aufgenommen", { userId });
          return;
        }

        log.info("🗣️ Benutzer beginnt zu sprechen - Starte Aufnahme", { userId });
        
        const audioStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.Manual
          }
        });

        // Speichere als MP3
        const fileName = `${recordingId}_${userId}.mp3`;
        const filePath = join(recordingsPath, fileName);

        // Erstelle Opus Transcoder
        const transcoder = new prism.opus.Decoder({
          rate: OPUS_SAMPLE_RATE,
          channels: OPUS_CHANNELS,
          frameSize: OPUS_FRAME_SIZE
        });

        // Erstelle Puffer für Audio-Daten
        const buffer = new PassThrough();

        // FFmpeg Prozess für Konvertierung zu MP3
        const ffmpeg = spawn(FFMPEG_PATH, [
          '-f', 's16le',           // Raw PCM 16-bit Little Endian
          '-ar', '48000',          // Sample rate
          '-ac', '2',              // Stereo
          '-i', 'pipe:0',          // Input from pipe
          '-c:a', 'libmp3lame',    // MP3 codec
          '-b:a', '320k',          // Konstante Bitrate
          '-bufsize', '960k',      // Größerer Buffer (3x Bitrate)
          '-minrate', '320k',      // Minimale Bitrate erzwingen
          '-maxrate', '320k',      // Maximale Bitrate erzwingen
          '-reservoir', '0',       // Kein VBR-Reservoir
          '-application', 'audio', // Optimiert für Audio
          '-shortest',            // Beende wenn Input endet
          filePath                // Output file
        ]);

        // Debug-Logging für FFmpeg
        ffmpeg.stderr.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Error') || output.includes('error')) {
            log.error("🔴 FFmpeg Fehler:", { output });
          } else {
            log.debug("🎵 FFmpeg Status:", { output });
          }
        });

        // Verbesserte Fehlerbehandlung
        ffmpeg.on('error', (error) => {
          log.error("❌ FFmpeg Prozess-Fehler:", { 
            error: error.message, 
            command: FFMPEG_PATH, 
            args: ffmpeg.spawnargs 
          });
          try {
            audioStream.destroy();
            transcoder.destroy();
            buffer.destroy();
            ffmpeg.kill();
          } catch (e) {
            log.error("💥 Fehler beim Aufräumen nach FFmpeg-Fehler:", e);
          }
        });

        // Pipe Audio durch Transcoder zum Puffer
        audioStream
          .pipe(transcoder)
          .pipe(buffer);

        // Pipe vom Puffer zu FFmpeg
        buffer.pipe(ffmpeg.stdin);

        // Fehlerbehandlung für Streams
        buffer.on('error', (error: NodeJS.ErrnoException) => {
          log.error("🔴 Stream Fehler:", { error: error.message });
          try {
            audioStream.destroy();
            transcoder.destroy();
            buffer.destroy();
            ffmpeg.kill();
          } catch (e) {
            log.error("💥 Fehler beim Aufräumen nach Stream-Fehler:", e);
          }
        });

        recording.userStreams.set(userId, {
          stream: audioStream,
          transcoder,
          buffer,
          ffmpeg,
          filePath
        });

        // Erfolgs-Logging
        ffmpeg.on('exit', (code, signal) => {
          if (code === 0) {
            log.info("✅ FFmpeg Konvertierung erfolgreich", { filePath });
          } else {
            log.error("❌ FFmpeg Prozess fehlgeschlagen", { code, signal, filePath });
          }
        });

        log.info("🎙️ Neue Audioaufnahme aktiv", { userId, filePath });
      } catch (error) {
        log.error("❌ Fehler beim Starten der Benutzer-Aufnahme", { userId, error });
      }
    });

    // Wir ignorieren das 'end' Event, da wir kontinuierlich aufnehmen wollen
    connection.receiver.speaking.on('end', (userId) => {
      log.debug("👤 Benutzer pausiert (Aufnahme läuft weiter)", { userId });
    });

    log.info("✨ Aufnahmesystem vollständig initialisiert und aktiv");
    return true;
  } catch (error) {
    log.error("❌ Fehler beim Starten der Audio-Aufnahme:", error);
    throw error;
  }
}

export async function stopAudioRecording(channelId: string): Promise<AudioRecording | null> {
  try {
    const recording = activeRecordings.get(channelId);
    if (!recording) {
      log.warn("⚠️ Keine aktive Audio-Aufnahme gefunden", { channelId });
      return null;
    }

    log.info("🛑 Beginne Beenden der Aufnahme...", { channelId });

    // Sammle alle Dateipfade
    const audioFiles: string[] = [];
    
    // Beende alle Streams sicher
    for (const [userId, userStream] of recording.userStreams) {
      try {
        log.info("🔄 Beende Audio-Stream", { userId });
        
        // Beende Streams sauber
        userStream.stream.destroy();
        userStream.transcoder.destroy();
        userStream.buffer.end();
        
        // Warte auf FFmpeg Beendigung
        await new Promise((resolve) => {
          userStream.ffmpeg.on('exit', () => {
            audioFiles.push(userStream.filePath);
            log.info("✅ FFmpeg Prozess beendet", { userId, filePath: userStream.filePath });
            resolve(null);
          });
        });
        
        // Zusätzliche Wartezeit für Dateisystem
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        log.error("❌ Fehler beim Beenden des Streams", { userId, error });
      }
    }

    // Entferne alle Listener
    recording.connection.receiver.speaking.removeAllListeners();
    
    // Trenne die Verbindung
    recording.connection.destroy();
    log.info("🔌 Voice-Verbindung getrennt");
    
    // Entferne die Aufnahme aus der Map
    activeRecordings.delete(channelId);
    
    log.info("✅ Audio-Aufnahme erfolgreich beendet", { 
      channelId, 
      fileCount: audioFiles.length,
      files: audioFiles 
    });

    return { audioFiles };
  } catch (error) {
    log.error("❌ Fehler beim Stoppen der Audio-Aufnahme:", error);
    throw error;
  }
} 
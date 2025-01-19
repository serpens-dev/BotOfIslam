import { 
  VoiceConnection, 
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioReceiveStream,
  EndBehaviorType,
  VoiceReceiver,
  getVoiceConnection,
  DiscordGatewayAdapterCreator
} from '@discordjs/voice';
import { VoiceChannel, GuildMember } from 'discord.js';
import { Readable } from 'stream';
import { createWriteStream, promises as fsPromises } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import * as prism from 'prism-media';
import ffmpeg from 'ffmpeg-static';
import log from "encore.dev/log";

interface AudioRecording {
  userId: string;
  stream: Readable;
  filename: string;
}

const activeRecordings = new Map<string, AudioRecording[]>();

export async function startAudioRecording(
  voiceChannel: VoiceChannel,
  participants?: string[]
): Promise<VoiceConnection> {
  try {
    // Verbinde mit dem Voice Channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      selfDeaf: false,
      selfMute: true
    });

    // Erstelle Aufnahme-Verzeichnis falls nicht vorhanden
    const recordingDir = join(process.cwd(), 'recordings', voiceChannel.id);
    await fsPromises.mkdir(recordingDir, { recursive: true });

    // Starte Aufnahme für jeden Teilnehmer
    const recordings: AudioRecording[] = [];
    const receiver = connection.receiver;

    voiceChannel.members.forEach((member) => {
      // Wenn participants definiert ist, nehme nur diese auf
      if (participants && !participants.includes(member.id)) {
        return;
      }

      const filename = join(recordingDir, `${member.id}_${Date.now()}.webm`);
      const audioStream = receiver.subscribe(member.id, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100
        }
      });

      // Konvertiere zu WebM mit FFmpeg
      const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
      const ffmpegProcess = spawn(ffmpeg!, [
        '-i', 'pipe:0',  // Input from stdin
        '-c:a', 'libopus', // Use Opus codec
        '-f', 'webm',    // WebM container
        'pipe:1'         // Output to stdout
      ]);

      // Speichere Stream
      const fileStream = createWriteStream(filename);
      
      // Verkette die Streams
      audioStream
        .pipe(opusDecoder)
        .pipe(ffmpegProcess.stdin);
      
      ffmpegProcess.stdout.pipe(fileStream);

      // Fehlerbehandlung
      ffmpegProcess.stderr.on('data', (data) => {
        log.debug('FFmpeg Output:', data.toString());
      });

      ffmpegProcess.on('error', (error) => {
        log.error('FFmpeg Prozess Fehler:', error);
      });

      recordings.push({
        userId: member.id,
        stream: audioStream,
        filename
      });

      log.info('Audio Aufnahme gestartet:', {
        userId: member.id,
        filename
      });
    });

    activeRecordings.set(voiceChannel.id, recordings);
    return connection;
  } catch (error) {
    log.error('Fehler beim Starten der Audio Aufnahme:', error);
    throw error;
  }
}

export async function stopAudioRecording(channelId: string): Promise<string[]> {
  const recordings = activeRecordings.get(channelId);
  if (!recordings) {
    throw new Error('Keine aktive Aufnahme in diesem Channel');
  }

  try {
    // Beende alle Aufnahmen
    recordings.forEach(recording => {
      recording.stream.destroy();
    });

    // Trenne Verbindung
    const connection = getVoiceConnection(channelId);
    if (connection) {
      connection.destroy();
    }

    // Entferne aus aktiven Aufnahmen
    activeRecordings.delete(channelId);

    // Gebe Liste der Aufnahme-Dateien zurück
    return recordings.map(r => r.filename);
  } catch (error) {
    log.error('Fehler beim Stoppen der Audio Aufnahme:', error);
    throw error;
  }
} 
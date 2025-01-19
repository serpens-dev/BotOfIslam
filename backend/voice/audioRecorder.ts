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

// ES Module __dirname Workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startAudioRecording(connection: VoiceConnection, recordingId: string) {
  try {
    // Create recordings directory
    const recordingDir = join(process.cwd(), 'recordings', recordingId);
    await mkdir(recordingDir, { recursive: true });

    // Create audio player
    const player = createAudioPlayer();
    connection.subscribe(player);

    // Get voice receiver
    const receiver = connection.receiver;

    // Start recording for each speaking user
    connection.receiver.speaking.on('start', async (userId) => {
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100
        }
      });

      const fileName = `${recordingId}_${userId}_${Date.now()}.webm`;
      const filePath = join(recordingDir, fileName);
      const fileStream = createWriteStream(filePath);

      try {
        // Convert AudioReceiveStream to Node.js Readable
        const nodeStream = Readable.from(audioStream as unknown as AsyncIterable<any>);
        
        // Handle stream events
        nodeStream.on('data', (chunk) => {
          fileStream.write(chunk);
        });

        nodeStream.on('end', async () => {
          fileStream.end();
          
          try {
            // Upload to Mega after recording is complete
            const storage = getStorage();
            const cloudPath = `audio/${fileName}`;
            const link = await storage.uploadFile(filePath, cloudPath);
            
            log.info('Aufnahme erfolgreich hochgeladen:', {
              userId,
              fileName,
              cloudLink: link
            });
          } catch (uploadError) {
            log.error('Fehler beim Hochladen der Aufnahme:', {
              error: uploadError,
              userId,
              fileName
            });
          }
        });

        // Handle errors
        nodeStream.on('error', (error) => {
          log.error(`Error in audio stream for user ${userId}:`, error);
          fileStream.end();
        });

        fileStream.on('error', (error) => {
          log.error(`Error writing audio file for user ${userId}:`, error);
        });

      } catch (error) {
        log.error(`Error recording audio for user ${userId}:`, error);
      }
    });

    return true;
  } catch (error) {
    log.error("Error starting audio recording:", error);
    throw error;
  }
}

export async function stopAudioRecording(channelId: string) {
  try {
    const connection = getVoiceConnection(channelId);
    if (connection) {
      connection.destroy();
    }
    return true;
  } catch (error) {
    log.error("Error stopping audio recording:", error);
    throw error;
  }
} 
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

export async function startAudioRecording(connection: VoiceConnection, recordingId: string) {
  try {
    // Create recordings directory
    const recordingDir = join(__dirname, '..', 'recordings', recordingId);
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

        nodeStream.on('end', () => {
          fileStream.end();
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
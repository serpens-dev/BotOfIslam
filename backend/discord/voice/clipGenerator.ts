import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import log from "encore.dev/log";
import { getStorage } from '../storage/megaStorage';

interface ClipOptions {
  startTime: Date;
  endTime: Date;
  inputFile: string;
  outputPath: string;
  duration?: number; // Dauer in Sekunden, Standard: 30s
}

/**
 * Erstellt einen Clip aus einer Aufnahme
 */
export async function createClip(options: ClipOptions): Promise<string> {
  const {
    startTime,
    endTime,
    inputFile,
    outputPath,
    duration = 30 // Standard: 30 Sekunden
  } = options;

  try {
    // Berechne Start- und Endzeit relativ zum Aufnahmestart
    const clipStart = Math.floor((startTime.getTime() - endTime.getTime()) / 1000);
    const clipEnd = clipStart + duration;

    // Erstelle Output Verzeichnis falls nicht vorhanden
    await fs.mkdir(join(process.cwd(), 'clips'), { recursive: true });

    // Erstelle Clip mit FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputFile,
        '-ss', clipStart.toString(),
        '-t', duration.toString(),
        '-c', 'copy',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // Upload Clip zu Mega
    const storage = getStorage();
    const fileName = outputPath.split('/').pop()!;
    const link = await storage.uploadFile(outputPath, `clips/${fileName}`);

    log.info('Clip erfolgreich erstellt:', {
      inputFile,
      outputPath,
      duration,
      link
    });

    return link;
  } catch (error) {
    log.error('Fehler beim Erstellen des Clips:', error);
    throw error;
  }
}

/**
 * Erstellt Clips für alle Highlights einer Aufnahme
 */
export async function createHighlightClips(
  audioFile: string,
  highlights: Array<{ timestamp: Date; description: string }>,
  recordingStart: Date
): Promise<Array<{ description: string; link: string }>> {
  const clips: Array<{ description: string; link: string }> = [];

  for (const highlight of highlights) {
    try {
      const outputPath = join(process.cwd(), 'clips', `highlight_${Date.now()}.webm`);
      
      const link = await createClip({
        startTime: highlight.timestamp,
        endTime: recordingStart,
        inputFile: audioFile,
        outputPath,
        duration: 30 // 30 Sekunden pro Highlight
      });

      clips.push({
        description: highlight.description,
        link
      });

      // Lösche temporäre Clip-Datei
      await fs.unlink(outputPath);
    } catch (error) {
      log.error('Fehler beim Erstellen des Highlight-Clips:', {
        error,
        highlight
      });
    }
  }

  return clips;
} 
import { VoiceDB } from './encore.service';
import { createClip } from './clipGenerator';
import { getStorage } from '../storage/megaStorage';
import log from "encore.dev/log";

interface ClipRequest {
  recordingId: number;
  startTime: Date;
  endTime: Date;
  duration: number;
  description: string;
  userId: string;
}

export async function createManualClip(request: ClipRequest): Promise<string> {
  try {
    // Hole Aufnahme Details
    const recording = await VoiceDB.queryRow<{
      audio_file: string;
      started_at: Date;
    }>`
      SELECT 
        rp.audio_file_path as audio_file,
        r.started_at
      FROM recordings r
      JOIN recording_participants rp ON rp.recording_id = r.id
      WHERE r.id = ${request.recordingId}
      LIMIT 1
    `;

    if (!recording) {
      throw new Error(`Aufnahme ${request.recordingId} nicht gefunden`);
    }

    // Erstelle temporären Clip
    const outputPath = `clips/manual_${Date.now()}.webm`;
    const link = await createClip({
      startTime: request.startTime,
      endTime: recording.started_at,
      inputFile: recording.audio_file,
      outputPath,
      duration: request.duration
    });

    // Speichere Clip in der Datenbank
    await VoiceDB.exec`
      INSERT INTO highlights (
        recording_id,
        timestamp,
        description,
        created_by,
        cloud_clip_link
      ) VALUES (
        ${request.recordingId},
        ${request.startTime},
        ${request.description},
        ${request.userId},
        ${link}
      )
    `;

    log.info('Manueller Clip erstellt:', {
      recordingId: request.recordingId,
      description: request.description,
      link
    });

    return link;
  } catch (error) {
    log.error('Fehler beim Erstellen des manuellen Clips:', error);
    throw error;
  }
}

export async function listRecordingClips(recordingId: number): Promise<Array<{
  timestamp: Date;
  description: string;
  createdBy: string;
  link: string;
}>> {
  try {
    const clips = await VoiceDB.query<{
      timestamp: Date;
      description: string;
      created_by: string;
      cloud_clip_link: string;
    }>`
      SELECT 
        timestamp,
        description,
        created_by,
        cloud_clip_link
      FROM highlights
      WHERE recording_id = ${recordingId}
        AND cloud_clip_link IS NOT NULL
      ORDER BY timestamp DESC
    `;

    const result = [];
    for await (const clip of clips) {
      result.push({
        timestamp: clip.timestamp,
        description: clip.description,
        createdBy: clip.created_by,
        link: clip.cloud_clip_link
      });
    }

    return result;
  } catch (error) {
    log.error('Fehler beim Abrufen der Clips:', error);
    throw error;
  }
} 
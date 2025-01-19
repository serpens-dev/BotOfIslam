import { CronJob } from "encore.dev/cron";
import { VoiceDB } from "./service";
import { getStorage } from "../storage/megaStorage";
import log from "encore.dev/log";

interface RecordingToDelete {
  id: number;
  audio_files: string[];
  screen_files: string[];
  clip_files: string[];
}

export async function cleanupRecordings() {
  try {
    // Hole alle Aufnahmen die älter als 7 Tage sind
    const rows = await VoiceDB.query<RecordingToDelete>`
      WITH old_recordings AS (
        SELECT 
          r.id,
          array_agg(DISTINCT rp.audio_file_path) as audio_files,
          array_agg(DISTINCT rp.screen_file_path) as screen_files,
          array_agg(DISTINCT h.clip_path) as clip_files
        FROM recordings r
        LEFT JOIN recording_participants rp ON rp.recording_id = r.id
        LEFT JOIN highlights h ON h.recording_id = r.id
        WHERE r.created_at < NOW() - INTERVAL '7 days'
        GROUP BY r.id
      )
      DELETE FROM recordings r
      USING old_recordings o
      WHERE r.id = o.id
      RETURNING o.*
    `;

    const storage = getStorage();
    let deletedFiles = 0;
    const recordingsToDelete = [];

    // Lösche Dateien von Mega
    for await (const row of rows) {
      recordingsToDelete.push(row);
      
      // Lösche Audio Files
      for (const file of row.audio_files) {
        if (file) {
          try {
            await storage.deleteFile(file);
            deletedFiles++;
          } catch (error) {
            log.error('Fehler beim Löschen der Audio-Datei:', {
              error,
              file,
              recordingId: row.id
            });
          }
        }
      }

      // Lösche Screen Recordings
      for (const file of row.screen_files) {
        if (file) {
          try {
            await storage.deleteFile(file);
            deletedFiles++;
          } catch (error) {
            log.error('Fehler beim Löschen der Screen-Datei:', {
              error,
              file,
              recordingId: row.id
            });
          }
        }
      }

      // Lösche Highlight Clips
      for (const file of row.clip_files) {
        if (file) {
          try {
            await storage.deleteFile(file);
            deletedFiles++;
          } catch (error) {
            log.error('Fehler beim Löschen des Clips:', {
              error,
              file,
              recordingId: row.id
            });
          }
        }
      }
    }

    log.info('Alte Aufnahmen gelöscht:', {
      recordingsDeleted: recordingsToDelete.length,
      filesDeleted: deletedFiles
    });
  } catch (error) {
    log.error('Fehler beim Aufräumen alter Aufnahmen:', error);
    throw error;
  }
}

// Lösche Aufnahmen die älter als 7 Tage sind
const _ = new CronJob("cleanup-recordings", {
  title: "Alte Aufnahmen löschen",
  schedule: "0 0 * * *", // Jeden Tag um Mitternacht
  endpoint: cleanupRecordings
}); 
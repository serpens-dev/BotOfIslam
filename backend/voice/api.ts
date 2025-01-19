import { api } from "encore.dev/api";
import { VoiceDB } from "./service";

// API Typen
interface Recording {
  id: number;
  channelId: string;
  startedAt: Date;
  endedAt?: Date;
  initiatorId: string;
  screenRecording: boolean;
  participants: Array<{
    userId: string;
    audioLink?: string;
    screenLink?: string;
  }>;
  highlights: Array<{
    id: number;
    timestamp: Date;
    description: string;
    createdBy: string;
    clipLink?: string;
  }>;
}

interface DBRecordingRow {
  id: number;
  channel_id: string;
  started_at: Date;
  ended_at: Date | null;
  initiator_id: string;
  screen_recording: boolean;
  participants: string; // JSON String
  highlights: string; // JSON String
}

interface GetRecordingParams {
  id: string;
}

// Liste alle Aufnahmen
export const listRecordings = api(
  { method: "GET", path: "/recordings" },
  async (): Promise<{ recordings: Recording[] }> => {
    const recordings: Recording[] = [];

    // Hole Aufnahmen mit Teilnehmern und Highlights
    const rows = await VoiceDB.query<DBRecordingRow>`
      SELECT 
        r.id,
        r.channel_id,
        r.started_at,
        r.ended_at,
        r.initiator_id,
        r.screen_recording,
        json_agg(DISTINCT jsonb_build_object(
          'userId', rp.user_id,
          'audioLink', rp.cloud_audio_link,
          'screenLink', rp.cloud_screen_link
        )) as participants,
        json_agg(DISTINCT jsonb_build_object(
          'id', h.id,
          'timestamp', h.timestamp,
          'description', h.description,
          'createdBy', h.created_by,
          'clipLink', h.cloud_clip_link
        )) as highlights
      FROM recordings r
      LEFT JOIN recording_participants rp ON rp.recording_id = r.id
      LEFT JOIN highlights h ON h.recording_id = r.id
      GROUP BY r.id
      ORDER BY r.started_at DESC
    `;

    for await (const row of rows) {
      recordings.push({
        id: row.id,
        channelId: row.channel_id,
        startedAt: row.started_at,
        endedAt: row.ended_at || undefined,
        initiatorId: row.initiator_id,
        screenRecording: row.screen_recording,
        participants: JSON.parse(row.participants || '[]'),
        highlights: JSON.parse(row.highlights || '[]')
      });
    }

    return { recordings };
  }
);

// Hole eine einzelne Aufnahme
export const getRecording = api<GetRecordingParams>(
  { method: "GET", path: "/recordings/:id" },
  async ({ id }): Promise<{ recording: Recording }> => {
    const row = await VoiceDB.queryRow<DBRecordingRow>`
      SELECT 
        r.id,
        r.channel_id,
        r.started_at,
        r.ended_at,
        r.initiator_id,
        r.screen_recording,
        json_agg(DISTINCT jsonb_build_object(
          'userId', rp.user_id,
          'audioLink', rp.cloud_audio_link,
          'screenLink', rp.cloud_screen_link
        )) as participants,
        json_agg(DISTINCT jsonb_build_object(
          'id', h.id,
          'timestamp', h.timestamp,
          'description', h.description,
          'createdBy', h.created_by,
          'clipLink', h.cloud_clip_link
        )) as highlights
      FROM recordings r
      LEFT JOIN recording_participants rp ON rp.recording_id = r.id
      LEFT JOIN highlights h ON h.recording_id = r.id
      WHERE r.id = ${parseInt(id)}
      GROUP BY r.id
    `;

    if (!row) {
      throw new Error(`Aufnahme ${id} nicht gefunden`);
    }

    const recording: Recording = {
      id: row.id,
      channelId: row.channel_id,
      startedAt: row.started_at,
      endedAt: row.ended_at || undefined,
      initiatorId: row.initiator_id,
      screenRecording: row.screen_recording,
      participants: JSON.parse(row.participants || '[]'),
      highlights: JSON.parse(row.highlights || '[]')
    };

    return { recording };
  }
); 
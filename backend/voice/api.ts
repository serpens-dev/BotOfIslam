import { api } from "encore.dev/api";
import { VoiceDB } from "./encore.service";
import { 
  startRecording as startRecordingImpl,
  stopRecording as stopRecordingImpl,
  toggleScreenRecording as toggleScreenRecordingImpl,
  addHighlight as addHighlightImpl
} from "./recording";

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

interface StartRecordingParams {
  channelId: string;
  initiatorId: string;
  participants?: string[];
}

interface StopRecordingParams {
  channelId: string;
}

interface ToggleScreenParams {
  channelId: string;
}

interface AddHighlightParams {
  channelId: string;
  description: string;
  userId: string;
}

interface GetRecordingParams {
  id: string;
}

// Starte eine neue Aufnahme
export const startRecording = api<StartRecordingParams>(
  { method: "POST", path: "/recordings/start" },
  async ({ channelId, initiatorId, participants }): Promise<{ recording: Recording }> => {
    const session = await startRecordingImpl(channelId, initiatorId, participants);
    return { 
      recording: {
        id: session.id,
        channelId: session.channelId,
        startedAt: session.startTime,
        initiatorId,
        screenRecording: session.screenRecording,
        participants: Array.from(session.participants).map(userId => ({ userId })),
        highlights: []
      }
    };
  }
);

// Stoppe eine Aufnahme
export const stopRecording = api<StopRecordingParams>(
  { method: "POST", path: "/recordings/:channelId/stop" },
  async ({ channelId }): Promise<{ recording: Recording }> => {
    const session = await stopRecordingImpl(channelId);
    return {
      recording: {
        id: session.id,
        channelId: session.channelId,
        startedAt: session.startTime,
        endedAt: new Date(),
        initiatorId: Array.from(session.participants)[0], // Erster Teilnehmer ist der Initiator
        screenRecording: session.screenRecording,
        participants: Array.from(session.participants).map(userId => ({
          userId,
          audioLink: session.cloudLinks.audio.find(link => link.includes(userId)),
          screenLink: session.cloudLinks.screen.find(link => link.includes(userId))
        })),
        highlights: session.highlights.map((h, id) => ({
          id,
          timestamp: h.timestamp,
          description: h.description,
          createdBy: h.createdBy,
          clipPath: h.clipPath
        }))
      }
    };
  }
);

// Toggle Screen Recording
export const toggleScreen = api<ToggleScreenParams>(
  { method: "POST", path: "/recordings/:channelId/screen" },
  async ({ channelId }): Promise<{ enabled: boolean }> => {
    const enabled = await toggleScreenRecordingImpl(channelId);
    return { enabled };
  }
);

// Füge einen Highlight hinzu
export const addHighlight = api<AddHighlightParams>(
  { method: "POST", path: "/recordings/:channelId/highlights" },
  async ({ channelId, description, userId }): Promise<{ highlight: { 
    id: number;
    timestamp: Date;
    description: string;
    createdBy: string;
    clipLink?: string;
  } }> => {
    const highlight = await addHighlightImpl(channelId, description, userId);
    return {
      highlight: {
        id: 0, // Wird in der Datenbank generiert
        timestamp: highlight.timestamp,
        description: highlight.description,
        createdBy: highlight.createdBy,
        clipLink: highlight.clipPath
      }
    };
  }
);

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
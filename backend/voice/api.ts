import { api } from "encore.dev/api";
import { VoiceDB } from "./encore.service";
import { 
  startRecording as startRecordingImpl,
  stopRecording as stopRecordingImpl,
  toggleScreenRecording as toggleScreenRecordingImpl,
  addHighlight as addHighlightImpl
} from "./recording";
import { Recording, Highlight, DBRecording, DBParticipant, DBHighlight } from "./types";
import { getVoiceChannel } from "./utils";

// API Typen
interface StartRecordingParams {
  channelId: string;
  initiatorId: string;
}

interface StopRecordingParams {
  channelId: string;
}

interface ToggleScreenParams {
  channelId: string;
}

interface AddHighlightParams {
  recordingId: number;
  timestamp: Date;
  description: string;
  userId: string;
}

interface GetRecordingParams {
  id: number;
}

// Starte eine neue Aufnahme
export const recordingStart = api(
  { method: "POST" },
  async (params: StartRecordingParams): Promise<{ recording: Recording }> => {
    const result = await VoiceDB.queryRow<DBRecording>`
      INSERT INTO recordings (channel_id, started_at, initiator_id, screen_recording)
      VALUES (${params.channelId}, NOW(), ${params.initiatorId}, false)
      RETURNING *
    `;

    if (!result) {
      throw new Error("Fehler beim Erstellen der Aufnahme");
    }

    const recording: Recording = {
      id: result.id,
      channelId: result.channel_id,
      startedAt: result.started_at,
      endedAt: result.ended_at,
      initiatorId: result.initiator_id,
      screenRecording: result.screen_recording,
      audioFiles: [],
      screenFiles: [],
      cloudLinks: {
        audio: [],
        screen: []
      },
      lastConfirmation: new Date(),
      participants: [],
      highlights: [],
      startTime: result.started_at
    };

    return { recording };
  }
);

// Stoppe eine Aufnahme
export const recordingStop = api(
  { method: "POST" },
  async (params: StopRecordingParams): Promise<{ recording: Recording }> => {
    const result = await VoiceDB.queryRow<DBRecording>`
      UPDATE recordings 
      SET ended_at = NOW()
      WHERE channel_id = ${params.channelId} AND ended_at IS NULL
      RETURNING *
    `;

    if (!result) {
      throw new Error("Keine aktive Aufnahme in diesem Channel");
    }

    // Fetch participants
    const participants = await VoiceDB.query<DBParticipant>`
      SELECT * FROM participants 
      WHERE recording_id = ${result.id}
    `;

    const participantsList = [];
    for await (const p of participants) {
      participantsList.push({
        userId: p.user_id,
        audioLink: p.audio_link,
        screenLink: p.screen_link
      });
    }

    // Fetch highlights
    const highlights = await VoiceDB.query<DBHighlight>`
      SELECT * FROM highlights 
      WHERE recording_id = ${result.id}
    `;

    const highlightsList = [];
    for await (const h of highlights) {
      highlightsList.push({
        id: h.id,
        recordingId: h.recording_id,
        timestamp: h.timestamp,
        description: h.description,
        userId: h.user_id,
        clipPath: h.clip_path
      });
    }

    const recording: Recording = {
      id: result.id,
      channelId: result.channel_id,
      startedAt: result.started_at,
      endedAt: result.ended_at,
      initiatorId: result.initiator_id,
      screenRecording: result.screen_recording,
      audioFiles: [],
      screenFiles: [],
      cloudLinks: {
        audio: [],
        screen: []
      },
      lastConfirmation: new Date(),
      participants: participantsList,
      highlights: highlightsList,
      startTime: result.started_at
    };

    return { recording };
  }
);

// Toggle Screen Recording
export const recordingToggleScreen = api(
  { method: "POST" },
  async (params: ToggleScreenParams): Promise<{ enabled: boolean }> => {
    const result = await VoiceDB.queryRow<DBRecording>`
      UPDATE recordings 
      SET screen_recording = NOT screen_recording
      WHERE channel_id = ${params.channelId} AND ended_at IS NULL
      RETURNING screen_recording
    `;

    if (!result) {
      throw new Error("Keine aktive Aufnahme in diesem Channel");
    }

    return { enabled: result.screen_recording };
  }
);

// Füge einen Highlight hinzu
export const recordingAddHighlight = api(
  { method: "POST" },
  async (params: AddHighlightParams): Promise<{ highlight: Highlight }> => {
    const result = await VoiceDB.queryRow<DBHighlight>`
      INSERT INTO highlights (recording_id, timestamp, description, user_id)
      VALUES (${params.recordingId}, ${params.timestamp}, ${params.description}, ${params.userId})
      RETURNING *
    `;

    if (!result) {
      throw new Error("Fehler beim Erstellen des Highlights");
    }

    const highlight: Highlight = {
      id: result.id,
      recordingId: result.recording_id,
      timestamp: result.timestamp,
      description: result.description,
      userId: result.user_id,
      clipPath: result.clip_path
    };

    return { highlight };
  }
);

// Liste alle Aufnahmen
export const listRecordings = api(
  { method: "GET", path: "/recordings" },
  async (): Promise<{ recordings: Recording[] }> => {
    const recordings: Recording[] = [];

    // Hole Aufnahmen mit Teilnehmern und Highlights
    const rows = await VoiceDB.query<DBRecording & { 
      participants: string;
      highlights: string;
    }>`
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
        highlights: JSON.parse(row.highlights || '[]'),
        audioFiles: [],
        screenFiles: [],
        cloudLinks: {
          audio: [],
          screen: []
        },
        lastConfirmation: row.started_at,
        startTime: row.started_at
      });
    }

    return { recordings };
  }
);

// Hole eine einzelne Aufnahme
export const getRecording = api(
  { method: "GET", path: "/recording/:id" },
  async (params: { id: string }): Promise<{ recording: Recording }> => {
    // Hole Basis-Aufnahme
    const result = await VoiceDB.queryRow<DBRecording>`
      SELECT * FROM recordings WHERE id = ${params.id}
    `;

    if (!result) {
      throw new Error("Aufnahme nicht gefunden");
    }

    // Hole Teilnehmer
    const participantsResult = await VoiceDB.query<DBParticipant>`
      SELECT 
        user_id,
        audio_link,
        screen_link
      FROM recording_participants
      WHERE recording_id = ${result.id}
    `;

    const participants = [];
    for await (const p of participantsResult) {
      participants.push({
        userId: p.user_id,
        audioLink: p.audio_link,
        screenLink: p.screen_link
      });
    }

    // Hole Highlights
    const highlightsResult = await VoiceDB.query<DBHighlight>`
      SELECT *
      FROM highlights
      WHERE recording_id = ${result.id}
    `;

    const highlights = [];
    for await (const h of highlightsResult) {
      highlights.push({
        id: h.id,
        recordingId: h.recording_id,
        timestamp: h.timestamp,
        description: h.description,
        userId: h.user_id,
        clipPath: h.clip_path
      });
    }

    // Erstelle vollständiges Recording-Objekt
    const recording: Recording = {
      id: result.id,
      channelId: result.channel_id,
      startedAt: result.started_at,
      endedAt: result.ended_at,
      initiatorId: result.initiator_id,
      screenRecording: result.screen_recording,
      participants,
      highlights,
      audioFiles: [],
      screenFiles: [],
      cloudLinks: {
        audio: participants.map(p => p.audioLink).filter((link): link is string => !!link),
        screen: participants.map(p => p.screenLink).filter((link): link is string => !!link)
      },
      lastConfirmation: result.started_at,
      startTime: result.started_at
    };

    return { recording };
  }
); 
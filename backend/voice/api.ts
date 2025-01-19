import { api } from "encore.dev/api";
import { VoiceDB } from "./encore.service";
import { 
  startRecording as startRecordingImpl,
  stopRecording as stopRecordingImpl,
  toggleScreenRecording as toggleScreenRecordingImpl,
  addHighlight as addHighlightImpl
} from "./recording";
import { Recording, Highlight, DBRecording, DBParticipant, DBHighlight } from "./types";

// API Typen
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
export const recordingStart = api<StartRecordingParams>(
  { method: "POST", path: "/recordings/start" },
  async ({ channelId, initiatorId, participants }): Promise<{ recording: Recording }> => {
    const session = await startRecordingImpl(channelId, initiatorId);
    return { 
      recording: {
        id: session.id,
        channelId: session.channelId,
        startedAt: session.startTime,
        initiatorId,
        screenRecording: session.screenRecording,
        participants: Array.from(session.participants).map(id => ({
          userId: id.toString(),
          audioLink: undefined,
          screenLink: undefined
        })),
        highlights: [],
        audioFiles: [],
        screenFiles: [],
        cloudLinks: {
          audio: [],
          screen: []
        },
        lastConfirmation: session.startTime,
        startTime: session.startTime
      }
    };
  }
);

// Stoppe eine Aufnahme
export const recordingStop = api<StopRecordingParams>(
  { method: "POST", path: "/recordings/:channelId/stop" },
  async ({ channelId }): Promise<{ recording: Recording }> => {
    const session = await stopRecordingImpl(channelId);
    return {
      recording: {
        id: session.id,
        channelId: session.channelId,
        startedAt: session.startTime,
        endedAt: new Date(),
        initiatorId: session.initiatorId,
        screenRecording: session.screenRecording,
        participants: Array.from(session.participants).map(id => ({
          userId: id.toString(),
          audioLink: session.cloudLinks.audio.find(link => link.includes(id.toString())),
          screenLink: session.cloudLinks.screen.find(link => link.includes(id.toString()))
        })),
        highlights: session.highlights.map(h => ({
          id: h.id,
          recordingId: session.id,
          timestamp: h.timestamp,
          description: h.description,
          userId: h.userId,
          createdBy: h.createdBy,
          clipPath: h.clipPath
        })),
        audioFiles: session.audioFiles,
        screenFiles: session.screenFiles,
        cloudLinks: session.cloudLinks,
        lastConfirmation: session.lastConfirmation,
        startTime: session.startTime
      }
    };
  }
);

// Toggle Screen Recording
export const recordingToggleScreen = api<ToggleScreenParams>(
  { method: "POST", path: "/recordings/:channelId/screen" },
  async ({ channelId }): Promise<{ enabled: boolean }> => {
    const enabled = await toggleScreenRecordingImpl(channelId);
    return { enabled };
  }
);

// Füge einen Highlight hinzu
export const recordingAddHighlight = api<AddHighlightParams>(
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
        cloud_audio_link,
        cloud_screen_link
      FROM recording_participants
      WHERE recording_id = ${result.id}
    `;

    const participants = [];
    for await (const p of participantsResult) {
      participants.push({
        userId: p.user_id,
        audioLink: p.cloud_audio_link,
        screenLink: p.cloud_screen_link
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
        createdBy: h.user_id,
        clipPath: h.cloud_clip_link
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
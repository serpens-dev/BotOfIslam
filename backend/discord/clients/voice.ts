import { api } from "encore.dev/api";
import { 
  startRecording as startRecordingImpl,
  stopRecording as stopRecordingImpl,
  toggleScreenRecording as toggleScreenRecordingImpl,
  addHighlight as addHighlightImpl
} from "../../voice/recording";

export interface Recording {
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

export interface Highlight {
  id: number;
  timestamp: Date;
  description: string;
  createdBy: string;
  clipLink?: string;
}

// Starte eine neue Aufnahme
export const startRecording = api<{ 
  channelId: string; 
  initiatorId: string; 
  participants?: string[]; 
}>(
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
export const stopRecording = api<{ channelId: string }>(
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
          clipLink: h.clipPath
        }))
      }
    };
  }
);

// Toggle Screen Recording
export const toggleScreen = api<{ channelId: string }>(
  { method: "POST", path: "/recordings/:channelId/screen" },
  async ({ channelId }): Promise<{ enabled: boolean }> => {
    const enabled = await toggleScreenRecordingImpl(channelId);
    return { enabled };
  }
);

// Füge einen Highlight hinzu
export const addHighlight = api<{ 
  channelId: string; 
  description: string; 
  userId: string; 
}>(
  { method: "POST", path: "/recordings/:channelId/highlights" },
  async ({ channelId, description, userId }): Promise<{ highlight: Highlight }> => {
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
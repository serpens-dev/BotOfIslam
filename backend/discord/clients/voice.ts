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

// Wrapper-Funktionen für einfachere Verwendung
export async function startRecording(channelId: string, initiatorId: string, participants?: string[]): Promise<{ recording: Recording }> {
  return await startRecordingApi({ channelId, initiatorId, participants });
}

export async function stopRecording(channelId: string): Promise<{ recording: Recording }> {
  return await stopRecordingApi({ channelId });
}

export async function toggleScreenRecording(channelId: string): Promise<{ enabled: boolean }> {
  return await toggleScreen({ channelId });
}

export async function addHighlight(channelId: string, description: string, userId: string): Promise<{ highlight: Highlight }> {
  return await addHighlightApi({ channelId, description, userId });
}

// API Endpunkte
export const startRecordingApi = api<{ 
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

export const stopRecordingApi = api<{ channelId: string }>(
  { method: "POST", path: "/recordings/:channelId/stop" },
  async ({ channelId }): Promise<{ recording: Recording }> => {
    const session = await stopRecordingImpl(channelId);
    return {
      recording: {
        id: session.id,
        channelId: session.channelId,
        startedAt: session.startTime,
        endedAt: new Date(),
        initiatorId: Array.from(session.participants)[0],
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

export const toggleScreen = api<{ channelId: string }>(
  { method: "POST", path: "/recordings/:channelId/screen" },
  async ({ channelId }): Promise<{ enabled: boolean }> => {
    const enabled = await toggleScreenRecordingImpl(channelId);
    return { enabled };
  }
);

export const addHighlightApi = api<{ 
  channelId: string; 
  description: string; 
  userId: string; 
}>(
  { method: "POST", path: "/recordings/:channelId/highlights" },
  async ({ channelId, description, userId }): Promise<{ highlight: Highlight }> => {
    const highlight = await addHighlightImpl(channelId, description, userId);
    return {
      highlight: {
        id: 0,
        timestamp: highlight.timestamp,
        description: highlight.description,
        createdBy: highlight.createdBy,
        clipLink: highlight.clipPath
      }
    };
  }
); 
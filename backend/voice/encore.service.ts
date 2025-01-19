import { Service } from "encore.dev/service";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { api } from "encore.dev/api";
import { Recording, Highlight } from "./types";
import { startRecording as startRecordingImpl, stopRecording as stopRecordingImpl, toggleScreenRecording as toggleScreenRecordingImpl, addHighlight as addHighlightImpl } from "./recording";

// Voice Service Datenbank für Aufnahmen und Highlights
export const VoiceDB = new SQLDatabase("voice", {
  migrations: "./migrations"
});

// Voice Service
export default new Service("voice");

// API Endpoints
export const startRecording = api(
  { method: "POST", path: "/recording/start" },
  async (params: { channelId: string; initiatorId: string }): Promise<{ recording: Recording }> => {
    const recording = await startRecordingImpl(params.channelId, params.initiatorId);
    return { recording };
  }
);

export const stopRecording = api(
  { method: "POST", path: "/recording/stop" },
  async (params: { channelId: string }): Promise<{ recording: Recording }> => {
    const recording = await stopRecordingImpl(params.channelId);
    return { recording };
  }
);

export const toggleScreenRecording = api(
  { method: "POST", path: "/recording/screen" },
  async (params: { channelId: string }): Promise<{ enabled: boolean }> => {
    const enabled = await toggleScreenRecordingImpl(params.channelId);
    return { enabled };
  }
);

export const addHighlight = api(
  { method: "POST", path: "/recording/highlight" },
  async (params: { channelId: string; description: string; userId: string }): Promise<{ highlight: Highlight }> => {
    const highlight = await addHighlightImpl(params.channelId, params.description, params.userId);
    return { highlight };
  }
);

import { voice } from "~encore/clients";
import { Recording, Highlight } from "../../voice/types";

// Starte eine neue Aufnahme
export async function startRecording(channelId: string, initiatorId: string): Promise<{ recording: Recording }> {
  return voice.startRecording({ channelId, initiatorId });
}

// Stoppe eine Aufnahme
export async function stopRecording(channelId: string): Promise<{ recording: Recording }> {
  return voice.stopRecording({ channelId });
}

// Toggle Screen Recording
export async function toggleScreenRecording(channelId: string): Promise<{ enabled: boolean }> {
  return voice.toggleScreen({ channelId });
}

// Füge einen Highlight hinzu
export async function addHighlight(channelId: string, description: string, userId: string): Promise<{ highlight: Highlight }> {
  return voice.addHighlight({ channelId, description, userId });
} 
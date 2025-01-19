import { voice } from "~encore/clients";
import { Recording, Highlight } from "../../voice/types";

// Starte eine neue Aufnahme
export async function startRecording(channelId: string, initiatorId: string): Promise<{ recording: Recording }> {
  return voice.recordingStart({ channelId, initiatorId });
}

// Stoppe eine Aufnahme
export async function stopRecording(channelId: string): Promise<{ recording: Recording }> {
  return voice.recordingStop({ channelId });
}

// Toggle Screen Recording
export async function toggleScreenRecording(channelId: string): Promise<{ enabled: boolean }> {
  return voice.recordingToggleScreen({ channelId });
}

// Add a highlight
export async function addHighlight(channelId: string, description: string, userId: string): Promise<{ highlight: Highlight }> {
  // Hole zuerst die aktive Aufnahme für den Channel
  const { recordings } = await voice.listRecordings();
  const activeRecording = recordings.find(r => r.channelId === channelId && !r.endedAt);
  
  if (!activeRecording) {
    throw new Error("Keine aktive Aufnahme in diesem Channel");
  }

  return voice.recordingAddHighlight({ 
    recordingId: activeRecording.id,
    timestamp: new Date(),
    description,
    userId
  });
}
import { voice } from "~encore/clients";

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

export async function startRecording(channelId: string, initiatorId: string, participants?: string[]) {
  return voice.startRecording({ channelId, initiatorId, participants });
}

export async function stopRecording(channelId: string) {
  return voice.stopRecording({ channelId });
}

export async function toggleScreenRecording(channelId: string) {
  return voice.toggleScreen({ channelId });
}

export async function addHighlight(channelId: string, description: string, userId: string) {
  return voice.addHighlight({ channelId, description, userId });
} 
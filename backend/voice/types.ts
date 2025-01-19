export interface Recording {
  id: number;
  channelId: string;
  startedAt: Date;
  endedAt?: Date;
  initiatorId: string;
  screenRecording: boolean;
  audioFiles: string[];
  screenFiles: string[];
  cloudLinks: {
    audio: string[];
    screen: string[];
  };
  lastConfirmation: Date;
  participants: {
    userId: string;
    audioLink?: string;
    screenLink?: string;
  }[];
  highlights: Highlight[];
  startTime: Date;
}

export interface Highlight {
  id: number;
  recordingId: number;
  timestamp: Date;
  description: string;
  userId: string;
  clipPath?: string;
}

export interface DBRecording {
  id: number;
  channel_id: string;
  started_at: Date;
  ended_at?: Date;
  initiator_id: string;
  screen_recording: boolean;
}

export interface DBParticipant {
  id: number;
  recording_id: number;
  user_id: string;
  audio_link?: string;
  screen_link?: string;
}

export interface DBHighlight {
  id: number;
  recording_id: number;
  timestamp: Date;
  description: string;
  user_id: string;
  clip_path?: string;
} 
export interface Recording {
  id: string;
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
  id: string;
  recordingId: string;
  timestamp: Date;
  description: string;
  userId: string;
  createdBy: string;
  clipPath?: string;
}

export interface DBRecording {
  id: string;
  channel_id: string;
  started_at: Date;
  ended_at?: Date;
  initiator_id: string;
  screen_recording: boolean;
}

export interface DBParticipant {
  recording_id: string;
  user_id: string;
  cloud_audio_link?: string;
  cloud_screen_link?: string;
}

export interface DBHighlight {
  id: string;
  recording_id: string;
  timestamp: Date;
  description: string;
  user_id: string;
  cloud_clip_link?: string;
} 
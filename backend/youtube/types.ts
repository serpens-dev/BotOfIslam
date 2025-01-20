export interface Channel {
  id: string;
  url: string;
  title: string;
  addedAt: string;
  addedBy: string;
}

export interface AddChannelRequest {
  url: string;
}

export interface AddChannelResponse {
  channel: Channel;
}

export interface RemoveChannelRequest {
  url: string;
}

export interface ListChannelsResponse {
  channels: Channel[];
}

export interface WebSubVerification {
  'hub.mode': string;
  'hub.topic': string;
  'hub.challenge': string;
  'hub.lease_seconds'?: string;
}

export interface FeedUpdate {
  channelId: string;
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
} 
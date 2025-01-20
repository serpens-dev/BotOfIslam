export interface Channel {
  id: string;
  url: string;
  title: string;
  lastVideoId?: string;
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
  channelId: string;
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
  feed: {
    entry?: {
      id: string;
      title: string;
      author: {
        name: string;
        uri: string;
      };
      published: string;
      updated: string;
    }[];
  };
} 
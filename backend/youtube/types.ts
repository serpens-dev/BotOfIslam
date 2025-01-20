export interface YouTubeChannel {
    id: string;
    name: string;
    url: string;
    addedAt: Date;
    lastVideoAt?: Date;
}

export interface WebSubNotification {
    feed: string;
    title: string;
    link: string;
    published: Date;
    author: string;
    videoId: string;
}

export interface ChannelSubscription {
    channelId: string;
    topic: string;
    lease: Date;
    secret: string;
} 
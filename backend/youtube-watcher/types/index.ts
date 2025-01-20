export interface YouTubeChannel {
    id: number;
    channelId: string;
    channelName: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChannelSubscription {
    id: number;
    channelId: number;
    discordUserId: string;
    createdAt: Date;
}

export interface NotificationSettings {
    id: number;
    guildId: string;
    channelId: string;
    createdAt: Date;
}

export interface WebSubNotification {
    feed: {
        entry: {
            "yt:videoId": string;
            "yt:channelId": string;
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
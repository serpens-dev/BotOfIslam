CREATE TABLE youtube_channels (
    id SERIAL PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    channel_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE channel_subscriptions (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES youtube_channels(id) ON DELETE CASCADE,
    discord_user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_settings (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id)
);

CREATE INDEX idx_channel_subscriptions_discord_user ON channel_subscriptions(discord_user_id);
CREATE INDEX idx_youtube_channels_channel_id ON youtube_channels(channel_id); 
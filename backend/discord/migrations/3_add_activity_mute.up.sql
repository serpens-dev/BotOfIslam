-- Aktivitäts-Tracking
CREATE TABLE user_activity (
    user_id TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    tracked_month DATE NOT NULL,
    PRIMARY KEY (user_id, tracked_month)
);

-- Mute-Präferenzen
CREATE TYPE mute_type AS ENUM ('text_only', 'emoji_only', 'gif_only', 'slow_mode', 'voice_only');

CREATE TABLE user_mute_preferences (
    user_id TEXT PRIMARY KEY,
    preferred_mute_type mute_type NOT NULL DEFAULT 'text_only'
);

-- Index für Performance
CREATE INDEX idx_user_activity_month ON user_activity(tracked_month); 
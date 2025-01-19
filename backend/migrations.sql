CREATE TABLE user_points (
    user_id TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recordings (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Neue Tabelle für Fitna-Punkte
CREATE TABLE fitna_points (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    given_by TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für das Tracking der letzten Punktevergabe pro User
CREATE TABLE point_cooldowns (
    user_id TEXT PRIMARY KEY,
    last_given_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Tabelle für die Mute-Historie
CREATE TABLE mute_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    points_count INTEGER NOT NULL,
    muted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    unmuted_at TIMESTAMP WITH TIME ZONE
);

-- Indizes für bessere Performance
CREATE INDEX idx_fitna_points_user_id ON fitna_points(user_id);
CREATE INDEX idx_fitna_points_created_at ON fitna_points(created_at); 
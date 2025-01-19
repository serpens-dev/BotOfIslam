-- Basis-Tabellen für das Discord-System

-- Punkte-System
CREATE TABLE user_points (
    user_id TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fitna-System Basis
CREATE TABLE fitna_points (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    given_by TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cooldown für Fitna-Punkte
CREATE TABLE point_cooldowns (
    user_id TEXT PRIMARY KEY,
    last_given_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Mute-Historie
CREATE TABLE mute_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    points_count INTEGER NOT NULL,
    muted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für Performance
CREATE INDEX idx_fitna_points_user ON fitna_points(user_id);
CREATE INDEX idx_fitna_points_created ON fitna_points(created_at);
CREATE INDEX idx_mute_history_user ON mute_history(user_id); 
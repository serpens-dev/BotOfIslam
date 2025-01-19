-- Teams Tabelle
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    members TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Achievements Tabelle
CREATE TABLE user_achievements (
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
);

-- Events Tabelle
CREATE TABLE active_events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    multiplier INTEGER NOT NULL DEFAULT 1
);

-- Aktivitäts-Tracking
CREATE TABLE user_activity (
    user_id TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tracked_month DATE NOT NULL,
    PRIMARY KEY (user_id, tracked_month)
);

-- Mute-Präferenzen
CREATE TABLE user_mute_preferences (
    user_id TEXT PRIMARY KEY,
    preferred_mute_type TEXT NOT NULL DEFAULT 'text_only'
); 
-- Aufnahmen Tabelle
CREATE TABLE recordings (
    id BIGSERIAL PRIMARY KEY,
    channel_id TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    initiator_id TEXT NOT NULL,
    screen_recording BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Aufnahme Teilnehmer
CREATE TABLE recording_participants (
    recording_id BIGINT REFERENCES recordings(id),
    user_id TEXT NOT NULL,
    audio_file_path TEXT,
    screen_file_path TEXT,
    cloud_audio_link TEXT,
    cloud_screen_link TEXT,
    PRIMARY KEY (recording_id, user_id)
);

-- Highlights
CREATE TABLE highlights (
    id BIGSERIAL PRIMARY KEY,
    recording_id BIGINT REFERENCES recordings(id),
    timestamp TIMESTAMP NOT NULL,
    description TEXT NOT NULL,
    created_by TEXT NOT NULL,
    clip_path TEXT,
    cloud_clip_link TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für Performance
CREATE INDEX idx_recordings_channel ON recordings(channel_id);
CREATE INDEX idx_recordings_date ON recordings(started_at);
CREATE INDEX idx_highlights_recording ON highlights(recording_id);
CREATE INDEX idx_highlights_timestamp ON highlights(timestamp); 
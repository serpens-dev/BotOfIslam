export type VideoSource = 'tiktok' | 'instagram' | 'youtube_shorts';

export interface VideoMetadata {
    url: string;
    source?: VideoSource;
    originalQuality: boolean;
    shouldCompress: boolean;
}

export interface VideoResponse {
    success: boolean;
    videoUrl?: string;
    error?: string;
} 
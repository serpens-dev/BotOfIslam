import { VideoSource } from '../types/video';

export function detectVideoSource(url: string): VideoSource {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('tiktok.com')) {
        return 'tiktok';
    }
    
    if (urlLower.includes('instagram.com')) {
        return 'instagram';
    }
    
    if (urlLower.includes('youtube.com/shorts') || urlLower.includes('youtu.be')) {
        return 'youtube_shorts';
    }
    
    throw new Error('Unsupported video source');
} 
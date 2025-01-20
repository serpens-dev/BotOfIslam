import { api } from 'encore.dev/api';
import { VideoMetadata, VideoResponse } from './types/video';
import { detectVideoSource } from './utils/detector';
import { downloadVideo } from './utils/downloader';
export const download = api<VideoMetadata, VideoResponse>(
    { 
        method: 'POST',
        path: '/download',
    },
    async ({ url, originalQuality, shouldCompress }) => {
        try {
            const source = detectVideoSource(url);
            const videoUrl = await downloadVideo(url, source, originalQuality, shouldCompress);
            
            return {
                success: true,
                videoUrl
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
); 
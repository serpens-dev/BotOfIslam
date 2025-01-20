declare module 'insta-fetcher' {
    interface PostInfo {
        media_urls?: string[];
    }

    export class InstaFetcher {
        fetchPost(url: string): Promise<PostInfo>;
    }
}

declare module 'tiktok-scraper-without-watermark' {
    interface VideoMeta {
        videoUrl?: string;
    }

    export function getVideoMeta(url: string): Promise<VideoMeta>;
} 
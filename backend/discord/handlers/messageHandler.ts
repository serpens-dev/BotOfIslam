import { Message } from 'discord.js';
import { video_downloader } from '~encore/clients';
import * as fs from 'fs';
import log from 'encore.dev/log';

const MAX_DISCORD_SIZE = 10 * 1024 * 1024; // 10MB für normale Server

async function getFileSize(filePath: string): Promise<number> {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
}

export async function handleMessage(message: Message) {
    // Ignoriere Bot-Nachrichten
    if (message.author.bot) return;

    // Prüfe auf Video-URLs
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const urls = message.content.match(urlPattern);

    if (!urls) return;

    for (const url of urls) {
        try {
            // Versuche das Video herunterzuladen
            const response = await video_downloader.download({
                url,
                originalQuality: false, // Immer komprimieren
                shouldCompress: true,
            });

            if (!response.success || !response.videoUrl) {
                log.error('Fehler beim Video-Download:', response.error);
                continue;
            }

            // Prüfe die Dateigröße
            const fileSize = await getFileSize(response.videoUrl);
            if (fileSize > MAX_DISCORD_SIZE) {
                await message.reply({
                        content: ''
                });
                continue;
            }

            // Sende das Video als Antwort
            await message.reply({
                content: '',
                files: [response.videoUrl]
            });

        } catch (error) {
            log.error('Fehler beim Verarbeiten der URL:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                url
            });
            
            // Sende eine benutzerfreundliche Fehlermeldung
            await message.reply({
                content: ''
            });
        }
    }
} 
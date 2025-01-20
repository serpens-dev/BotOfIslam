import { VideoSource } from '../types/video';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import youtubedl from 'youtube-dl-exec';
import log from 'encore.dev/log';

// Setze FFmpeg Pfade basierend auf Betriebssystem
if (process.platform === 'win32') {
    // Windows Pfade
    ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
    ffmpeg.setFfprobePath('C:\\ffmpeg\\bin\\ffprobe.exe');
} else {
    // Linux/Docker Pfade
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    ffmpeg.setFfprobePath('/usr/bin/ffprobe');
}

const TEMP_DIR = path.join(os.tmpdir(), 'voice-of-islam-videos');
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in Bytes

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function getFileSize(filePath: string): Promise<number> {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
}

async function compressVideo(inputPath: string, targetSize: number): Promise<string> {
    const compressedPath = path.join(TEMP_DIR, `${uuidv4()}_compressed.mp4`);
    const inputSize = await getFileSize(inputPath);
    
    // Berechne Bitrate basierend auf Zielgröße
    // Formel: Bitrate = (Zielgröße in Bits) / (Videolänge in Sekunden)
    const duration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
    
    // Zielbitrate in Bits pro Sekunde (mit 20% Puffer)
    const targetBitrate = Math.floor((targetSize * 8 * 0.8) / duration);
    
    log.info('Starte Video Komprimierung', { 
        inputSize,
        targetSize,
        duration,
        targetBitrate
    });
    
    await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                `-b:v ${targetBitrate}`,    // Video Bitrate
                '-maxrate 800k',            // Maximale Bitrate reduziert
                '-bufsize 1600k',           // Buffer Größe angepasst
                '-preset ultrafast',        // Schnellste Kodierung
                '-crf 32',                  // Höhere Kompression
                '-vf scale=-2:720',         // Skaliere auf 720p
                '-c:a aac',
                '-b:a 64k',                // Noch niedrigere Audio Bitrate
                '-ac 1',                    // Mono Audio
                '-movflags +faststart'      // Schnelleres Starten der Wiedergabe
            ])
            .on('start', (command) => {
                log.info('FFmpeg Befehl gestartet', { command });
            })
            .on('progress', (progress) => {
                log.info('Komprimierung Fortschritt', { 
                    frames: progress.frames,
                    fps: progress.currentFps,
                    percent: progress.percent,
                    targetSize: progress.targetSize
                });
            })
            .on('end', () => {
                log.info('Komprimierung erfolgreich', { compressedPath });
                resolve();
            })
            .on('error', (err) => {
                log.error('Fehler bei der Komprimierung', { 
                    error: err.message,
                    inputPath,
                    compressedPath
                });
                reject(new Error(`Compression error: ${err.message}`));
            })
            .save(compressedPath);
    });

    // Prüfe die finale Größe
    const finalSize = await getFileSize(compressedPath);
    if (finalSize > targetSize) {
        log.warn('Video ist immer noch zu groß, versuche erneute Komprimierung', {
            finalSize,
            targetSize
        });
        // Lösche die erste Komprimierung
        fs.unlinkSync(compressedPath);
        // Versuche es mit noch aggressiveren Einstellungen
        return compressVideo(inputPath, targetSize * 0.7);
    }

    return compressedPath;
}

async function downloadSocialVideo(url: string, platform: VideoSource): Promise<string> {
    const tempFilePath = path.join(TEMP_DIR, `${uuidv4()}.mp4`);
    
    try {
        log.info(`Starte ${platform} Download`, { url, tempFilePath });
        
        // Download video direkt als MP4
        await youtubedl(url, {
            output: tempFilePath,
            format: 'best[ext=mp4]/best',  // Versuche MP4, falls nicht verfügbar, nimm bestes Format
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
        });

        log.info(`${platform} Download erfolgreich`, { tempFilePath });
        return tempFilePath;
    } catch (error) {
        log.error(`Fehler beim ${platform} Download`, { 
            error: error instanceof Error ? error.message : 'Unknown error',
            url,
            tempFilePath 
        });
        
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        throw error;
    }
}

export async function downloadVideo(
    url: string,
    source: VideoSource,
    originalQuality: boolean,
    shouldCompress: boolean
): Promise<string> {
    try {
        log.info('Starte Video Download', { url, source, originalQuality, shouldCompress });
        
        // Download mit youtube-dl für alle Plattformen
        const downloadedPath = await downloadSocialVideo(url, source);
        let finalPath = downloadedPath;
        
        const fileSize = await getFileSize(downloadedPath);
        log.info('Video heruntergeladen', { fileSize, maxSize: MAX_FILE_SIZE });
        
        // Wenn die Datei zu groß ist oder Komprimierung gewünscht ist
        if (fileSize > MAX_FILE_SIZE || shouldCompress) {
            finalPath = await compressVideo(downloadedPath, MAX_FILE_SIZE * 0.95); // 95% des Limits als Ziel
            fs.unlinkSync(downloadedPath); // Lösche Original nach Komprimierung
        }
        
        return finalPath;
    } catch (error) {
        log.error('Fehler beim Video Download', {
            error: error instanceof Error ? error.message : 'Unknown error',
            url,
            source
        });
        throw error;
    }
} 
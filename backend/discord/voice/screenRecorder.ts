import puppeteer, { Browser, Page } from 'puppeteer';
import { join } from 'path';
import { promises as fsPromises } from 'fs';
import log from "encore.dev/log";

interface ScreenRecording {
  userId: string;
  browser: Browser;
  page: Page;
  filename: string;
}

const activeScreenRecordings = new Map<string, ScreenRecording>();

export async function startScreenRecording(
  channelId: string,
  userId: string,
  streamUrl: string
): Promise<void> {
  try {
    // Erstelle Aufnahme-Verzeichnis falls nicht vorhanden
    const recordingDir = join(process.cwd(), 'recordings', channelId);
    await fsPromises.mkdir(recordingDir, { recursive: true });

    const filename = join(recordingDir, `screen_${userId}_${Date.now()}.webm`);

    // Starte Browser
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Navigiere zur Stream URL
    await page.goto(streamUrl);

    // Starte Screen Recording
    await page.evaluate(() => {
      // @ts-ignore
      const stream = document.querySelector('video').captureStream();
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screen.webm';
        a.click();
      };

      mediaRecorder.start();
    });

    // Speichere aktive Aufnahme
    activeScreenRecordings.set(userId, {
      userId,
      browser,
      page,
      filename
    });

    log.info('Screen Recording gestartet:', {
      userId,
      filename
    });
  } catch (error) {
    log.error('Fehler beim Starten des Screen Recordings:', error);
    throw error;
  }
}

export async function stopScreenRecording(userId: string): Promise<string | null> {
  const recording = activeScreenRecordings.get(userId);
  if (!recording) {
    return null;
  }

  try {
    // Stoppe Recording
    await recording.page.evaluate(() => {
      // @ts-ignore
      document.querySelector('video').mediaRecorder.stop();
    });

    // Warte kurz bis die Datei gespeichert wurde
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Schließe Browser
    await recording.browser.close();

    // Entferne aus aktiven Aufnahmen
    activeScreenRecordings.delete(userId);

    log.info('Screen Recording gestoppt:', {
      userId,
      filename: recording.filename
    });

    return recording.filename;
  } catch (error) {
    log.error('Fehler beim Stoppen des Screen Recordings:', error);
    throw error;
  }
} 
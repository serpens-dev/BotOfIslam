import { File, Storage as MegaStorage } from 'megajs';
import { createReadStream, createWriteStream } from 'fs';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import log from "encore.dev/log";

interface StorageConfig {
  email: string;
  password: string;
  uploadFolder: string;
}

interface MegaFile {
  name: string;
  directory: boolean;
  size: number;
  timestamp: number;
  downloadFile(): Promise<Buffer>;
  link(options?: { noKey?: boolean }): Promise<string>;
  delete(): Promise<void>;
}

// Erweitere den Storage-Typ
interface ExtendedStorage extends MegaStorage {
  fs: {
    children: MegaFile[];
  };
}

class MegaStorageClient {
  private storage!: ExtendedStorage;
  private uploadFolder: string;
  private initialized: boolean = false;

  constructor(private config: StorageConfig) {
    this.uploadFolder = config.uploadFolder;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.storage = new MegaStorage({
        email: this.config.email,
        password: this.config.password
      }) as ExtendedStorage;

      await this.storage.ready;
      this.initialized = true;

      log.info('Mega Storage initialisiert');
    } catch (error) {
      log.error('Fehler beim Initialisieren des Mega Storage:', error);
      throw error;
    }
  }

  private async retryOperation<T>(operation: () => Promise<T>, maxRetries = 5, delay = 2000): Promise<T> {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        log.warn(`Operation fehlgeschlagen, Versuch ${i + 1}/${maxRetries}`, { error });
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponentielles Backoff
      }
    }
    
    throw lastError;
  }

  async uploadFile(localPath: string, remoteName: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Prüfe ob Datei existiert
      await fsPromises.access(localPath);
      
      // Erstelle Upload Pfad (immer mit Forward Slashes)
      const uploadPath = join(this.uploadFolder, remoteName).split(/[\\/]/).join('/').replace(/^\//, '');
      
      // Prüfe Dateigröße
      const stats = await fsPromises.stat(localPath);
      if (stats.size === 0) {
        throw new Error('Datei ist leer');
      }
      
      log.info('Starte Upload:', {
        localPath,
        remotePath: uploadPath,
        fileSize: stats.size
      });

      // Upload mit Retry-Logik
      const file = await this.retryOperation(async () => {
        // Erstelle einen Readable Stream für die Datei
        const fileStream = createReadStream(localPath);
        
        // Erstelle den Upload-Stream mit der korrekten Größe
        const uploadStream = this.storage.upload({
          name: uploadPath,
          size: stats.size
        });

        // Pipe den File-Stream in den Upload-Stream und warte auf Abschluss
        await new Promise((resolve, reject) => {
          fileStream.on('error', reject);
          uploadStream.on('error', reject);
          fileStream.pipe(uploadStream as any);
          uploadStream.on('complete', resolve);
        });

        // Hole das Upload-Ergebnis
        const uploadResult = await uploadStream.complete;
        if (!uploadResult) {
          throw new Error('Upload fehlgeschlagen - keine Datei zurückgegeben');
        }
        
        return uploadResult;
      }, 5, 3000);

      // Prüfe ob die hochgeladene Datei die richtige Größe hat
      if (file.size !== stats.size) {
        throw new Error(`Upload fehlgeschlagen - Größenmismatch: ${file.size} != ${stats.size}`);
      }

      // Erstelle Download Link mit Retry-Logik
      const link = await this.retryOperation(async () => {
        const linkResult = await file.link({ noKey: false });
        if (!linkResult) {
          throw new Error('Konnte keinen Download-Link erstellen');
        }
        return linkResult;
      }, 3, 2000);

      log.info('Datei erfolgreich hochgeladen:', {
        localPath,
        remotePath: uploadPath,
        link,
        fileSize: stats.size,
        uploadedSize: file.size
      });

      return link;
    } catch (error) {
      // Detaillierte Fehlerprotokollierung
      log.error('Fehler beim Hochladen der Datei:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        localPath,
        remoteName
      });
      throw error;
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const files = await this.storage.fs.children;
      const file = files.find((f: MegaFile) => f.name === remotePath);
      
      if (file) {
        await file.delete();
        log.info('Datei erfolgreich gelöscht:', { remotePath });
      } else {
        throw new Error(`Datei ${remotePath} nicht gefunden`);
      }
    } catch (error) {
      log.error('Fehler beim Löschen der Datei:', {
        error,
        remotePath
      });
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const files = await this.storage.fs.children;
      return files
        .filter((f: MegaFile) => !prefix || f.name.startsWith(prefix))
        .map((f: MegaFile) => f.name);
    } catch (error) {
      log.error('Fehler beim Auflisten der Dateien:', error);
      throw error;
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const files = await this.storage.fs.children;
      const file = files.find((f: MegaFile) => f.name === remotePath);

      if (!file) {
        throw new Error(`Datei ${remotePath} nicht gefunden`);
      }

      const downloadStream = await file.downloadFile();
      const writeStream = createWriteStream(localPath);

      await new Promise((resolve, reject) => {
        writeStream.write(downloadStream, (error) => {
          if (error) reject(error);
          else resolve(undefined);
        });
      });

      log.info('Datei erfolgreich heruntergeladen:', {
        remotePath,
        localPath
      });
    } catch (error) {
      log.error('Fehler beim Herunterladen der Datei:', {
        error,
        remotePath,
        localPath
      });
      throw error;
    }
  }
}

// Singleton Instanz
let instance: MegaStorageClient | null = null;

export async function initializeStorage(config: StorageConfig): Promise<MegaStorageClient> {
  if (!instance) {
    instance = new MegaStorageClient(config);
    await instance.initialize();
  }
  return instance;
}

export function getStorage(): MegaStorageClient {
  if (!instance) {
    throw new Error('Storage nicht initialisiert');
  }
  return instance;
} 
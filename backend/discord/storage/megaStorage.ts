import { File, Storage, createStorage } from 'megajs';
import { createReadStream, createWriteStream } from 'fs';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import log from "encore.dev/log";

interface StorageConfig {
  email: string;
  password: string;
  uploadFolder: string;
}

class MegaStorage {
  private storage: Storage;
  private uploadFolder: string;
  private initialized: boolean = false;

  constructor(private config: StorageConfig) {
    this.uploadFolder = config.uploadFolder;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.storage = await createStorage({
        email: this.config.email,
        password: this.config.password
      });

      await this.storage.ready;
      this.initialized = true;

      log.info('Mega Storage initialisiert');
    } catch (error) {
      log.error('Fehler beim Initialisieren des Mega Storage:', error);
      throw error;
    }
  }

  async uploadFile(localPath: string, remoteName: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Prüfe ob Datei existiert
      await fsPromises.access(localPath);

      // Erstelle Upload Pfad
      const uploadPath = join(this.uploadFolder, remoteName);

      // Upload Datei
      const file = await this.storage.upload(localPath, uploadPath).complete;

      // Erstelle Download Link
      const link = await file.link();

      log.info('Datei erfolgreich hochgeladen:', {
        localPath,
        remotePath: uploadPath,
        link
      });

      return link;
    } catch (error) {
      log.error('Fehler beim Hochladen der Datei:', {
        error,
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
      const file = await this.storage.getFile(remotePath);
      await file.delete();

      log.info('Datei erfolgreich gelöscht:', {
        remotePath
      });
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
      const files = await this.storage.getFiles();
      return files
        .filter(f => !prefix || f.name.startsWith(prefix))
        .map(f => f.name);
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
      const file = await this.storage.getFile(remotePath);
      const downloadStream = await file.download();
      const writeStream = createWriteStream(localPath);

      await new Promise((resolve, reject) => {
        downloadStream.pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
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
let instance: MegaStorage | null = null;

export async function initializeStorage(config: StorageConfig): Promise<MegaStorage> {
  if (!instance) {
    instance = new MegaStorage(config);
    await instance.initialize();
  }
  return instance;
}

export function getStorage(): MegaStorage {
  if (!instance) {
    throw new Error('Storage nicht initialisiert');
  }
  return instance;
} 
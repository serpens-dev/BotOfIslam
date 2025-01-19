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
      const link = await file.link({ noKey: false });

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
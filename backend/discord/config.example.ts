import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import log from "encore.dev/log";

// ES Module Workaround für __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lade .env Datei
const envPath = join(__dirname, '.env');
log.info(`Versuche .env Datei zu laden von: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  log.warn(`Fehler beim Laden der .env Datei: ${result.error.message}`);
  // Setze die Variablen direkt
  process.env.DISCORD_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
  process.env.DISCORD_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
  process.env.GUILD_ID = 'YOUR_GUILD_ID_HERE';
  process.env.NOTIFICATION_CHANNEL_ID = 'YOUR_NOTIFICATION_CHANNEL_HERE';
}

log.info('Umgebungsvariablen:', {
  token_exists: !!process.env.DISCORD_BOT_TOKEN,
  client_id_exists: !!process.env.DISCORD_CLIENT_ID,
  env_path: envPath
});

if (!process.env.DISCORD_BOT_TOKEN) {
  throw new Error('DISCORD_BOT_TOKEN ist nicht in der .env Datei definiert');
}

if (!process.env.DISCORD_CLIENT_ID) {
  throw new Error('DISCORD_CLIENT_ID ist nicht in der .env Datei definiert');
}

// Discord Bot Konfiguration
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

// Server Konfiguration
export const GUILD_ID = process.env.GUILD_ID!;
export const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID!; 
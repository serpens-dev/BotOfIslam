import { Client, Events, GatewayIntentBits } from 'discord.js';
import log from "encore.dev/log";
import { handleCommand } from './handlers/commandHandler';
import { registerCommands } from './commands';
import { DISCORD_BOT_TOKEN } from './config';

// Client mit notwendigen Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ]
});

// Bot Ready Event
client.once(Events.ClientReady, (readyClient) => {
  log.info(`Bot ist bereit! Eingeloggt als ${readyClient.user.tag}`);
});

// Command Handler
client.on(Events.InteractionCreate, handleCommand);

// Bot starten
export async function startBot() {
  try {
    log.info("Starte Bot...");
    await registerCommands();
    await client.login(DISCORD_BOT_TOKEN);
    log.info("Bot wurde erfolgreich gestartet");
  } catch (error) {
    log.error("Fehler beim Starten des Bots:", error);
    throw error;
  }
}

export { client }; 
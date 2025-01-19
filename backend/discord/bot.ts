import { Client, Events, GatewayIntentBits } from 'discord.js';
import log from "encore.dev/log";
import { handleCommand } from './handlers/commandHandler';
import { handleButton } from './handlers/buttonHandler';
import { handleModal } from './handlers/modalHandler';
import { registerCommands } from './commands';
import { DISCORD_BOT_TOKEN } from './config';
import { initializeStorage } from './storage/megaStorage';

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
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (error) {
    log.error('Fehler beim Verarbeiten der Interaktion:', error);
  }
});

// Bot starten
export async function startBot() {
  try {
    log.info("Starte Bot...");

    // Initialisiere Storage
    await initializeStorage({
      email: process.env.MEGA_EMAIL!,
      password: process.env.MEGA_PASSWORD!,
      uploadFolder: process.env.MEGA_UPLOAD_FOLDER || '/recordings'
    });

    // Registriere Commands und starte Bot
    await registerCommands();
    await client.login(DISCORD_BOT_TOKEN);
    log.info("Bot wurde erfolgreich gestartet");
  } catch (error) {
    log.error("Fehler beim Starten des Bots:", error);
    throw error;
  }
}

export { client }; 
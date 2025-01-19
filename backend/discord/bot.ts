import { Client, Events, GatewayIntentBits, ApplicationCommandDataResolvable } from 'discord.js';
import log from "encore.dev/log";
import { handleCommand } from './handlers/commandHandler';
import { handleButton } from './handlers/buttonHandler';
import { handleModal } from './handlers/modalHandler';
import { recordingCommands } from './commands/recording';
import { DISCORD_BOT_TOKEN } from './config';
import { initializeStorage } from '../voice/storage';

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
client.once(Events.ClientReady, async () => {
  log.info(`Bot ist bereit als ${client.user?.tag}!`);

  try {
    // Registriere Commands
    if (!client.application) {
      throw new Error('Client application not ready');
    }

    const commandData = recordingCommands.map(command => command.toJSON());
    await client.application.commands.set(commandData);
    log.info('Commands erfolgreich registriert!');
  } catch (error) {
    log.error('Fehler beim Registrieren der Commands:', error);
  }
});

// Command Handler
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
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

export async function startBot() {
  try {
    // Initialisiere Storage
    initializeStorage({
      email: process.env.MEGA_EMAIL!,
      password: process.env.MEGA_PASSWORD!,
      uploadFolder: process.env.MEGA_UPLOAD_FOLDER || '/recordings'
    });

    // Login to Discord
    await client.login(DISCORD_BOT_TOKEN);
    log.info("Bot started successfully");
  } catch (error) {
    log.error('Failed to start bot', error);
    throw error;
  }
}

// Starte den Bot
startBot().catch(error => {
  log.error('Failed to start bot:', error);
  process.exit(1);
});

export { client }; 
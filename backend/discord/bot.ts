import { Client, Events, GatewayIntentBits, ApplicationCommandDataResolvable } from 'discord.js';
import log from "encore.dev/log";
import { handleCommand } from './handlers/commandHandler';
import { handleButton } from './handlers/buttonHandler';
import { handleModal } from './handlers/modalHandler';
import { recordingCommands } from './commands/recording';
import { youtubeCommands } from './commands/youtube';
import { DISCORD_BOT_TOKEN } from './config';
import { initializeStorage } from '../voice/storage';
import { handleMessage } from './handlers/messageHandler';
import { initializeVoiceRecording } from '../voice/recording';

let client: Client | null = null;

export function getDiscordClient(): Client | null {
  return client;
}

// Client mit notwendigen Intents
const clientInstance = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ]
});

// Bot Ready Event
clientInstance.once(Events.ClientReady, async () => {
  log.info(`Bot ist bereit als ${clientInstance.user?.tag}!`);

  try {
    // Registriere Commands
    if (!clientInstance.application) {
      throw new Error('Client application not ready');
    }

    const commandData = [
      ...recordingCommands.map(command => command.data.toJSON()),
      ...youtubeCommands.map(command => command.data.toJSON())
    ];
    await clientInstance.application.commands.set(commandData);
    log.info('Commands erfolgreich registriert!');

    // Initialisiere Voice Recording
    await initializeVoiceRecording();
    log.info('Voice Recording System initialisiert!');
  } catch (error) {
    log.error('Fehler beim Initialisieren:', error);
  }
});

// Command Handler
clientInstance.on(Events.InteractionCreate, async (interaction) => {
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

// Message Handler für Video-Downloads
clientInstance.on(Events.MessageCreate, handleMessage);

export async function startBot() {
  try {
    // Initialize storage
    await initializeStorage({
      email: process.env.MEGA_EMAIL!,
      password: process.env.MEGA_PASSWORD!,
      uploadFolder: process.env.DRIVE_UPLOAD_FOLDER || '/recordings'
    });

    // Login to Discord
    await clientInstance.login(DISCORD_BOT_TOKEN);
    client = clientInstance; // Setze den globalen Client
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

export { clientInstance }; 
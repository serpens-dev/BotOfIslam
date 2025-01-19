import { Client, Events, GatewayIntentBits } from 'discord.js';
import log from "encore.dev/log";
import { handleCommand } from './handlers/commandHandler';
import { handleButton } from './handlers/buttonHandler';
import { handleModal } from './handlers/modalHandler';
import { commands } from './commands';
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
  log.info('Bot ist bereit!');

  try {
    // Registriere Commands
    const commandData = commands.map(command => command.toJSON());
    await client.application?.commands.set(commandData);
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

// Initialisiere Storage
initializeStorage({
  email: process.env.MEGA_EMAIL!,
  password: process.env.MEGA_PASSWORD!,
  uploadFolder: process.env.MEGA_UPLOAD_FOLDER || '/recordings'
});

// Login
client.login(DISCORD_BOT_TOKEN);

export { client }; 
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID } from '../config';
import log from "encore.dev/log";

const commands = [
  new SlashCommandBuilder()
    .setName('points')
    .setDescription('Zeigt deine Punkte an'),
  
  new SlashCommandBuilder()
    .setName('addpoints')
    .setDescription('Fügt einem Benutzer Punkte hinzu')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Der Benutzer')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Anzahl der Punkte')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('record')
    .setDescription('Startet eine Aufnahme im aktuellen Voice-Channel'),

  new SlashCommandBuilder()
    .setName('stoprecord')
    .setDescription('Stoppt die aktuelle Aufnahme'),

  new SlashCommandBuilder()
    .setName('fitna')
    .setDescription('Vergebe einen Fitna-Punkt')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Der Benutzer')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für den Fitna-Punkt')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('fitnapoints')
    .setDescription('Zeige Fitna-Punkte an')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Der Benutzer (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('fitnaleaderboard')
    .setDescription('Zeige das Fitna-Leaderboard')
    .addStringOption(option =>
      option.setName('zeitraum')
        .setDescription('Zeitraum für das Leaderboard')
        .setRequired(true)
        .addChoices(
          { name: 'Dieser Monat', value: 'month' },
          { name: 'Alle Zeit', value: 'all' }
        )),

  new SlashCommandBuilder()
    .setName('fitnamod')
    .setDescription('Moderiere Fitna-Punkte')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Füge Fitna-Punkte hinzu')
        .addUserOption(option => option.setName('user').setDescription('Der Benutzer').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Anzahl der Punkte').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Entferne Fitna-Punkte')
        .addUserOption(option => option.setName('user').setDescription('Der Benutzer').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Anzahl der Punkte').setRequired(true))),

  new SlashCommandBuilder()
    .setName('mutetype')
    .setDescription('Setze deine bevorzugte Mute-Art')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Art des Mutes')
        .setRequired(true)
        .addChoices(
          { name: 'Nur Text', value: 'text_only' },
          { name: 'Nur Emojis', value: 'emoji_only' },
          { name: 'Nur GIFs', value: 'gif_only' },
          { name: 'Slow Mode', value: 'slow_mode' },
          { name: 'Nur Voice', value: 'voice_only' }
        )),
];

export async function registerCommands() {
  const rest = new REST().setToken(DISCORD_BOT_TOKEN);

  try {
    log.info('Registriere Application Commands...');

    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands },
    );

    log.info('Application Commands erfolgreich registriert');
  } catch (error) {
    log.error('Fehler beim Registrieren der Commands:', error);
    throw error;
  }
} 
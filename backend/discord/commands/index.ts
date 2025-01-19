import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { recordingCommands } from './recording';

export const commands: (SlashCommandBuilder | SlashCommandOptionsOnlyBuilder)[] = [
  ...recordingCommands
]; 
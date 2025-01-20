import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder
} from 'discord.js';

export type CommandData = 
  | SlashCommandBuilder 
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder;

export interface Command {
  data: CommandData;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
} 
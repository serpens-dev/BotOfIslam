import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction
} from 'discord.js';
import log from "encore.dev/log";
import { Channel } from '../../youtube/types';
import { addChannel, removeChannel, loadChannels } from '../../youtube/storage';
import { Command } from './types';

export const youtubeCommands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName('youtube-add')
      .setDescription('Fügt einen YouTube Kanal zur Überwachung hinzu')
      .addStringOption(option =>
        option
          .setName('url')
          .setDescription('Die URL des YouTube Kanals')
          .setRequired(true)
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      try {
        const url = interaction.options.getString('url', true);
        await interaction.deferReply();
        
        const channel = await addChannel(url);
        await interaction.editReply(`✅ YouTube Kanal \`${channel.title}\` wurde zur Überwachung hinzugefügt.`);
      } catch (error) {
        log.error('Fehler bei YouTube Add Command:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
        
        if (interaction.deferred) {
          await interaction.editReply(`❌ Fehler: ${errorMessage}`);
        } else {
          await interaction.reply(`❌ Fehler: ${errorMessage}`);
        }
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('youtube-remove')
      .setDescription('Entfernt einen YouTube Kanal von der Überwachung')
      .addStringOption(option =>
        option
          .setName('url')
          .setDescription('Die URL des YouTube Kanals')
          .setRequired(true)
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      try {
        const url = interaction.options.getString('url', true);
        await interaction.deferReply();
        
        await removeChannel(url);
        await interaction.editReply('✅ YouTube Kanal wurde von der Überwachung entfernt.');
      } catch (error) {
        log.error('Fehler bei YouTube Remove Command:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
        
        if (interaction.deferred) {
          await interaction.editReply(`❌ Fehler: ${errorMessage}`);
        } else {
          await interaction.reply(`❌ Fehler: ${errorMessage}`);
        }
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('youtube-list')
      .setDescription('Zeigt alle überwachten YouTube Kanäle an'),
    async execute(interaction: ChatInputCommandInteraction) {
      try {
        await interaction.deferReply();
        const channels = await loadChannels();
        
        if (channels.length === 0) {
          await interaction.editReply('❌ Es werden aktuell keine YouTube Kanäle überwacht.');
          return;
        }
        
        const channelList = channels.map(c => `- ${c.title} (${c.url})`).join('\n');
        await interaction.editReply(`📺 **Überwachte YouTube Kanäle:**\n${channelList}`);
      } catch (error) {
        log.error('Fehler bei YouTube List Command:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
        
        if (interaction.deferred) {
          await interaction.editReply(`❌ Fehler: ${errorMessage}`);
        } else {
          await interaction.reply(`❌ Fehler: ${errorMessage}`);
        }
      }
    }
  }
]; 
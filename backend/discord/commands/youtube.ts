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
      .setName('youtube')
      .setDescription('YouTube Kanal Verwaltung')
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Fügt einen YouTube Kanal zur Überwachung hinzu')
          .addStringOption(option =>
            option
              .setName('url')
              .setDescription('Die URL des YouTube Kanals')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove')
          .setDescription('Entfernt einen YouTube Kanal von der Überwachung')
          .addStringOption(option =>
            option
              .setName('url')
              .setDescription('Die URL des YouTube Kanals')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('Zeigt alle überwachten YouTube Kanäle an')
      ),
    
    async execute(interaction: ChatInputCommandInteraction) {
      const subcommand = interaction.options.getSubcommand();

      try {
        switch (subcommand) {
          case 'add': {
            const url = interaction.options.getString('url', true);
            await interaction.deferReply();
            
            const channel = await addChannel(url);
            await interaction.editReply(`✅ YouTube Kanal \`${channel.title}\` wurde zur Überwachung hinzugefügt.`);
            break;
          }
          
          case 'remove': {
            const url = interaction.options.getString('url', true);
            await interaction.deferReply();
            
            await removeChannel(url);
            await interaction.editReply('✅ YouTube Kanal wurde von der Überwachung entfernt.');
            break;
          }
          
          case 'list': {
            await interaction.deferReply();
            const channels = await loadChannels();
            
            if (channels.length === 0) {
              await interaction.editReply('❌ Es werden aktuell keine YouTube Kanäle überwacht.');
              return;
            }
            
            const channelList = channels.map(c => `- ${c.title} (${c.url})`).join('\n');
            await interaction.editReply(`📺 **Überwachte YouTube Kanäle:**\n${channelList}`);
            break;
          }
        }
      } catch (error) {
        log.error('Fehler bei YouTube Command:', error);
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
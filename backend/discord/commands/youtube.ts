import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import log from "encore.dev/log";
import { Channel } from '../../youtube/types';
import { addChannel, removeChannel, loadChannels } from '../../youtube/storage';
import { Command } from './types';
import { youtube } from '~encore/clients';

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

export async function handleYoutubeCommand(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'add':
        await handleAddChannel(interaction);
        break;
      case 'remove':
        await handleRemoveChannel(interaction);
        break;
      case 'list':
        await handleListChannels(interaction);
        break;
    }
  } catch (error) {
    log.error('Fehler bei YouTube Command:', error);
    await interaction.reply({ content: 'Ein Fehler ist aufgetreten', ephemeral: true });
  }
}

async function handleAddChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const url = interaction.options.getString('url', true);

  try {
    const response = await youtube.add({ url });
    await interaction.editReply(`✅ Kanal ${response.channel.url} wurde hinzugefügt!`);
  } catch (error) {
    log.error('Fehler beim Hinzufügen des Kanals:', error);
    await interaction.editReply('❌ Fehler beim Hinzufügen des Kanals');
  }
}

async function handleRemoveChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const url = interaction.options.getString('url', true);

  try {
    await youtube.remove({ channelId: url });
    await interaction.editReply(`✅ Kanal wurde entfernt!`);
  } catch (error) {
    log.error('Fehler beim Entfernen des Kanals:', error);
    await interaction.editReply('❌ Fehler beim Entfernen des Kanals');
  }
}

async function handleListChannels(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const { channels } = await youtube.list();
    
    if (channels.length === 0) {
      await interaction.editReply('Keine Kanäle in der Überwachung.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📺 Überwachte YouTube Kanäle')
      .setColor('#FF0000')
      .setDescription(channels.map((channel: Channel) => 
        `• [${channel.url}](${channel.url})`
      ).join('\n'));

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    log.error('Fehler beim Auflisten der Kanäle:', error);
    await interaction.editReply('❌ Fehler beim Abrufen der Kanäle');
  }
} 
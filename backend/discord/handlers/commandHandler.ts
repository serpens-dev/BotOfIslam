import { Interaction, GuildMember, VoiceChannel, ChatInputCommandInteraction, EmbedBuilder, APIEmbed, EmbedType } from 'discord.js';
import { db } from '../db';
import { addPoints, getPoints, hasRequiredRole } from '../utils';
import { startRecording, stopRecording } from '../../voice/recording';
import log from "encore.dev/log";
import { giveFitnaPoint, getRandomMessage } from '../fitna/fitnaSystem';
import { getDetailedLeaderboard } from '../fitna/leaderboardSystem';
import { MuteType, getMuteTypeDisplay } from '../fitna/muteTypes';
import { commands } from '../commands';

export async function handleCommand(interaction: ChatInputCommandInteraction) {
  const command = commands.find(cmd => cmd.data.name === interaction.commandName);
  if (!command) {
    log.error(`Kein Handler für Command "${interaction.commandName}" gefunden`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    log.error('Fehler beim Ausführen des Commands:', error);
    
    const reply = {
      content: 'Es ist ein Fehler aufgetreten beim Ausführen des Commands.',
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  }
} 
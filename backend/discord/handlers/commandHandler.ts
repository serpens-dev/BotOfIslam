import { Interaction, GuildMember, VoiceChannel, ChatInputCommandInteraction, EmbedBuilder, APIEmbed, EmbedType } from 'discord.js';
import { db } from '../db';
import { addPoints, getPoints, hasRequiredRole } from '../utils';
import { startRecording, stopRecording } from '../../voice/recording';
import log from "encore.dev/log";
import { giveFitnaPoint, getRandomMessage } from '../fitna/fitnaSystem';
import { getDetailedLeaderboard } from '../fitna/leaderboardSystem';
import { MuteType, getMuteTypeDisplay } from '../fitna/muteTypes';
import { 
  handleRecordCommand, 
  handleStopRecordCommand, 
  handleScreenCommand, 
  handleHighlightCommand 
} from '../commands/recording';

export async function handleCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    const command = interaction.commandName;
    const member = interaction.member;

    if (!member) {
      await interaction.reply({ content: 'Fehler: Kein Mitglied gefunden.', ephemeral: true });
      return;
    }

    switch (command) {
      case 'points':
        const points = await getPoints(member.user.id);
        const embed = new EmbedBuilder()
          .setTitle('Fitna Punkte')
          .setDescription(`Du hast aktuell ${points} Fitna Punkte.`)
          .setColor(0xff0000);
        
        await interaction.reply({ content: `Du hast aktuell ${points} Fitna Punkte.`, ephemeral: true });
        break;

      case 'addpoints':
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        if (user && amount) {
          await addPoints(user.id, amount);
          await interaction.reply(`${amount} Punkte wurden ${user.username} hinzugefügt!`);
        }
        break;

      case 'record':
        await handleRecordCommand(interaction);
        break;

      case 'stoprecord':
        await handleStopRecordCommand(interaction);
        break;

      case 'screen':
        await handleScreenCommand(interaction);
        break;

      case 'highlight':
        await handleHighlightCommand(interaction);
        break;

      case 'fitna':
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('grund');
        const fitnaMember = interaction.member as GuildMember;

        if (!await hasRequiredRole(fitnaMember)) {
          await interaction.reply({
            content: "Du brauchst die Vertrauenswürdig Rolle um Fitna-Punkte zu vergeben!",
            ephemeral: true
          });
          return;
        }

        try {
          await giveFitnaPoint(targetUser.id, interaction.user.id, reason || undefined);
          await interaction.reply({
            content: `${getRandomMessage()} ${targetUser} hat einen Fitna-Punkt von ${interaction.user} erhalten!${reason ? `\nGrund: ${reason}` : ''}`
          });
        } catch (error) {
          if (error instanceof Error) {
            await interaction.reply({
              content: error.message,
              ephemeral: true
            });
          }
        }
        break;

      case 'fitnaleaderboard':
        const timeframe = interaction.options.getString('zeitraum', true) as 'month' | 'all';
        const guild = interaction.guild;
        if (!guild) {
          await interaction.reply({
            content: 'Dieser Befehl kann nur auf einem Server verwendet werden!',
            ephemeral: true
          });
          return;
        }

        try {
          const embedData = await getDetailedLeaderboard(timeframe, Array.from(guild.members.cache.values()).map(m => m.user));
          const embed: APIEmbed = {
            ...embedData,
            type: EmbedType.Rich
          };
          await interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        } catch (error) {
          log.error('Fehler beim Erstellen des Leaderboards:', error);
          await interaction.reply({
            content: 'Es ist ein Fehler beim Erstellen des Leaderboards aufgetreten!',
            ephemeral: true
          });
        }
        break;

      case 'mutetype':
        try {
          const muteType = interaction.options.getString('type', true) as MuteType;
          
          await db.exec`
            INSERT INTO user_mute_preferences (user_id, preferred_mute_type)
            VALUES (${interaction.user.id}, ${muteType})
            ON CONFLICT (user_id) 
            DO UPDATE SET preferred_mute_type = ${muteType}
          `;

          await interaction.reply({
            content: `Deine bevorzugte Mute-Art wurde auf ${getMuteTypeDisplay(muteType)} gesetzt!`,
            ephemeral: true
          });
        } catch (error) {
          log.error('Fehler beim Setzen der Mute-Präferenz:', error);
          await interaction.reply({
            content: 'Es ist ein Fehler aufgetreten!',
            ephemeral: true
          });
        }
        break;

      default:
        log.warn('Unbekannter Command:', command);
        break;
    }
  } catch (error) {
    log.error("Error handling command:", { error });
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'Ein Fehler ist aufgetreten beim Ausführen des Commands.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'Ein Fehler ist aufgetreten beim Ausführen des Commands.',
        ephemeral: true
      });
    }
  }
} 
import { Interaction, GuildMember, VoiceChannel, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../db';
import { addPoints, getPoints } from '../points/pointsSystem';
import { startRecording, stopRecording } from '../voice/recording';
import log from "encore.dev/log";
import { hasRequiredRole } from '../fitna/fitnaSystem';
import { giveFitnaPoint } from '../fitna/fitnaSystem';
import { getRandomMessage } from '../fitna/fitnaSystem';
import { getDetailedLeaderboard } from '../fitna/leaderboardSystem';
import { MuteType, getMuteTypeDisplay } from '../fitna/muteTypes';
import { 
  handleRecordCommand, 
  handleStopRecordCommand, 
  handleScreenCommand, 
  handleHighlightCommand 
} from '../commands/recording';

export async function handleCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'points':
        const points = await getPoints(interaction.user.id);
        await interaction.reply(`Du hast ${points} Punkte!`);
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
          const embed = await getDetailedLeaderboard(timeframe, Array.from(guild.members.cache.values()).map(m => m.user));
          await interaction.reply({ embeds: [embed] });
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
        log.warn('Unbekannter Command:', interaction.commandName);
        break;
    }
  } catch (error) {
    log.error('Fehler beim Ausführen des Commands:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'Es ist ein Fehler aufgetreten beim Ausführen des Commands.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'Es ist ein Fehler aufgetreten beim Ausführen des Commands.',
        ephemeral: true
      });
    }
  }
} 
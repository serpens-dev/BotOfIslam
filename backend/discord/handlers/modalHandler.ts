import { ModalSubmitInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { addHighlight } from '../../voice/recording';
import log from "encore.dev/log";

export async function handleModal(interaction: ModalSubmitInteraction) {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === 'highlight_modal') {
    const member = interaction.member as GuildMember;
    if (!member.voice.channel || !(member.voice.channel instanceof VoiceChannel)) {
      await interaction.reply({
        content: 'Du musst im Voice-Channel sein um einen Highlight zu setzen!',
        ephemeral: true
      });
      return;
    }

    try {
      const description = interaction.fields.getTextInputValue('description');
      const highlight = await addHighlight(member.voice.channel.id, description, member.id);

      await interaction.reply({
        content: `Highlight gesetzt: "${description}" bei ${formatTimestamp(highlight.timestamp)}`,
        ephemeral: true
      });
    } catch (error: any) {
      log.error('Fehler beim Setzen des Highlights:', error);
      await interaction.reply({
        content: `Fehler: ${error.message || 'Unbekannter Fehler'}`,
        ephemeral: true
      });
    }
  }
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('de-DE', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
} 
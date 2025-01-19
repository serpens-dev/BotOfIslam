import { ButtonInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { toggleScreenRecording, addHighlight, stopRecording } from '../voice/recording';
import log from "encore.dev/log";

export async function handleButton(interaction: ButtonInteraction) {
  if (!interaction.isButton()) return;

  const member = interaction.member as GuildMember;
  if (!member.voice.channel || !(member.voice.channel instanceof VoiceChannel)) {
    await interaction.reply({
      content: 'Du musst im Voice-Channel sein um die Aufnahme zu steuern!',
      ephemeral: true
    });
    return;
  }

  try {
    switch (interaction.customId) {
      case 'screen_record':
        const isEnabled = await toggleScreenRecording(member.voice.channel.id);
        await interaction.reply({
          content: `Screen Recording ${isEnabled ? 'aktiviert' : 'deaktiviert'}!`,
          ephemeral: true
        });
        break;

      case 'add_highlight':
        // Öffne Modal für Highlight Beschreibung
        await interaction.showModal({
          title: 'Highlight setzen',
          customId: 'highlight_modal',
          components: [{
            type: 1,
            components: [{
              type: 4,
              customId: 'description',
              label: 'Beschreibung',
              style: 2,
              minLength: 1,
              maxLength: 100,
              placeholder: 'Was ist passiert?',
              required: true
            }]
          }]
        });
        break;

      case 'stop_recording':
        const session = await stopRecording(member.voice.channel.id);
        await interaction.reply({
          content: `Aufnahme gestoppt! Länge: ${formatDuration(new Date().getTime() - session.startTime.getTime())}`,
          components: [] // Entferne alle Buttons
        });
        break;

      default:
        log.warn('Unbekannter Button:', interaction.customId);
        break;
    }
  } catch (error: any) {
    log.error('Fehler beim Ausführen des Buttons:', error);
    await interaction.reply({
      content: `Fehler: ${error.message || 'Unbekannter Fehler'}`,
      ephemeral: true
    });
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
} 
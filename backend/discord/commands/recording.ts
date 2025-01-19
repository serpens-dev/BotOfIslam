import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  ChannelType,
  GuildMember,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  VoiceChannel,
  ChatInputCommandInteraction
} from 'discord.js';
import { 
  startRecording, 
  stopRecording, 
  toggleScreenRecording, 
  addHighlight 
} from '../clients/voice';
import log from "encore.dev/log";

export const recordingCommands = [
  new SlashCommandBuilder()
    .setName('record')
    .setDescription('Startet eine Aufnahme im aktuellen Voice-Channel'),

  new SlashCommandBuilder()
    .setName('stoprecord')
    .setDescription('Stoppt die aktuelle Aufnahme'),

  new SlashCommandBuilder()
    .setName('screen')
    .setDescription('Aktiviert/Deaktiviert Screen Recording für die aktuelle Aufnahme'),

  new SlashCommandBuilder()
    .setName('highlight')
    .setDescription('Setzt einen Highlight-Marker in der Aufnahme')
    .addStringOption(option =>
      option.setName('beschreibung')
        .setDescription('Beschreibung des Highlights')
        .setRequired(true)
    )
];

export async function handleRecordCommand(interaction: ChatInputCommandInteraction) {
  try {
    const member = interaction.member as GuildMember;
    const channel = member.voice.channel as VoiceChannel;

    if (!channel) {
      await interaction.reply({ 
        content: 'Du musst in einem Voice Channel sein um eine Aufnahme zu starten!',
        ephemeral: true 
      });
      return;
    }

    // Sofort antworten
    await interaction.reply({ 
      content: 'Starte Aufnahme...',
      ephemeral: true 
    });

    // Aufnahme im Hintergrund starten
    const recording = await startRecording(
      channel.id,
      member.id,
      channel.members.map(m => m.id)
    );

    // Erfolg in den Channel senden
    await channel.send('🎙️ Aufnahme gestartet!');

  } catch (error: any) {
    log.error('Fehler beim Starten der Aufnahme:', error);
    
    // Fehler als Follow-up senden
    try {
      await interaction.followUp({ 
        content: `Fehler beim Starten der Aufnahme: ${error.message}`,
        ephemeral: true 
      });
    } catch (e) {
      log.error('Fehler beim Senden der Fehlermeldung:', e);
    }
  }
}

export async function handleStopRecordCommand(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel || !(member.voice.channel instanceof VoiceChannel)) {
    await interaction.reply({
      content: 'Du musst im Voice-Channel sein um die Aufnahme zu stoppen!',
      ephemeral: true
    });
    return;
  }

  try {
    const { recording } = await stopRecording(member.voice.channel.id);
    await interaction.reply({
      content: `Aufnahme gestoppt! Länge: ${formatDuration(new Date().getTime() - recording.startedAt.getTime())}`,
      components: [] // Entferne alle Buttons
    });
  } catch (error: any) {
    log.error('Fehler beim Stoppen der Aufnahme:', error);
    await interaction.reply({
      content: `Fehler beim Stoppen der Aufnahme: ${error.message || 'Unbekannter Fehler'}`,
      ephemeral: true
    });
  }
}

export async function handleScreenCommand(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel || !(member.voice.channel instanceof VoiceChannel)) {
    await interaction.reply({
      content: 'Du musst im Voice-Channel sein um Screen Recording zu ändern!',
      ephemeral: true
    });
    return;
  }

  try {
    const { enabled } = await toggleScreenRecording(member.voice.channel.id);
    await interaction.reply({
      content: `Screen Recording ${enabled ? 'aktiviert' : 'deaktiviert'}!`,
      ephemeral: true
    });
  } catch (error: any) {
    log.error('Fehler beim Ändern des Screen Recordings:', error);
    await interaction.reply({
      content: `Fehler beim Ändern des Screen Recordings: ${error.message || 'Unbekannter Fehler'}`,
      ephemeral: true
    });
  }
}

export async function handleHighlightCommand(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel || !(member.voice.channel instanceof VoiceChannel)) {
    await interaction.reply({
      content: 'Du musst im Voice-Channel sein um einen Highlight zu setzen!',
      ephemeral: true
    });
    return;
  }

  const description = interaction.options.getString('beschreibung', true);

  try {
    const { highlight } = await addHighlight(member.voice.channel.id, description, member.id);
    await interaction.reply({
      content: `Highlight gesetzt: "${description}" bei ${formatTimestamp(highlight.timestamp)}`,
      ephemeral: true
    });
  } catch (error: any) {
    log.error('Fehler beim Setzen des Highlights:', error);
    await interaction.reply({
      content: `Fehler beim Setzen des Highlights: ${error.message || 'Unbekannter Fehler'}`,
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

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('de-DE', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
} 
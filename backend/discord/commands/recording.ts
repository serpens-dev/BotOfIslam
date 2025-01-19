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
} from '../../voice/recording';
import log from "encore.dev/log";

export const recordingCommands = [
  new SlashCommandBuilder()
    .setName('record')
    .setDescription('Startet eine Aufnahme im aktuellen Voice-Channel')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Benutzer der aufgenommen werden soll (optional)')
        .setRequired(false)
    ),

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
  const member = interaction.member as GuildMember;
  if (!member.voice.channel || !(member.voice.channel instanceof VoiceChannel)) {
    await interaction.reply({
      content: 'Du musst in einem Voice-Channel sein um eine Aufnahme zu starten!',
      ephemeral: true
    });
    return;
  }

  try {
    const selectedUser = interaction.options.getUser('user');
    const participants = selectedUser ? [selectedUser.id] : undefined;

    const session = await startRecording(member.voice.channel, member, participants);
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('screen_record')
          .setLabel('Screen Recording')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('add_highlight')
          .setLabel('Highlight setzen')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('stop_recording')
          .setLabel('Aufnahme stoppen')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      content: 'Aufnahme gestartet! Nutze die Buttons um die Aufnahme zu steuern.',
      components: [row]
    });
  } catch (error: any) {
    log.error('Fehler beim Starten der Aufnahme:', error);
    await interaction.reply({
      content: `Fehler beim Starten der Aufnahme: ${error.message || 'Unbekannter Fehler'}`,
      ephemeral: true
    });
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
    const session = await stopRecording(member.voice.channel.id);
    await interaction.reply({
      content: `Aufnahme gestoppt! Länge: ${formatDuration(new Date().getTime() - session.startTime.getTime())}`,
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
    const isEnabled = await toggleScreenRecording(member.voice.channel.id);
    await interaction.reply({
      content: `Screen Recording ${isEnabled ? 'aktiviert' : 'deaktiviert'}!`,
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
    const highlight = await addHighlight(member.voice.channel.id, description, member.id);
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
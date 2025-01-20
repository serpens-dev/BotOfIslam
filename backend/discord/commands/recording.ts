import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  ChannelType,
  GuildMember,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  VoiceChannel,
  ChatInputCommandInteraction,
  ApplicationCommandDataResolvable
} from 'discord.js';
import log from "encore.dev/log";
import { voice } from "~encore/clients";

interface Recording {
  id: number;
  channelId: string;
  startedAt: Date;
  endedAt?: Date;
  initiatorId: string;
  screenRecording: boolean;
  cloudLinks: {
    audio: string[];
    screen: string[];
  };
}

export const recordingCommands = [
  new SlashCommandBuilder()
    .setName('record')
    .setDescription('Startet eine neue Aufnahme'),

  new SlashCommandBuilder()
    .setName('stoprecord')
    .setDescription('Stoppt die aktuelle Aufnahme'),

  new SlashCommandBuilder()
    .setName('screen')
    .setDescription('Aktiviert/Deaktiviert Screen Recording'),

  new SlashCommandBuilder()
    .setName('highlight')
    .setDescription('Markiert einen wichtigen Moment in der Aufnahme')
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Beschreibung des Highlights')
        .setRequired(true)
    )
];

export async function handleRecordCommand(interaction: ChatInputCommandInteraction) {
  try {
    // Sofort bestätigen dass wir die Anfrage verarbeiten
    await interaction.reply('Starte Aufnahme...');

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.editReply('Du musst in einem Voice Channel sein um die Aufnahme zu starten.');
      return;
    }

    // Starte Aufnahme
    const { recording } = await voice.startRecording({ 
      channelId: voiceChannel.id,
      initiatorId: member.id
    });

    // Sende Erfolg in den Channel
    await voiceChannel.send('🎙️ Aufnahme gestartet!');
    await interaction.editReply('Aufnahme läuft!');

  } catch (error: any) {
    log.error('Fehler beim Starten der Aufnahme:', error);
    
    // Versuche Fehlermeldung zu senden
    try {
      await interaction.editReply('Aufnahme konnte nicht gestartet werden');
    } catch (e) {
      log.error('Fehler beim Senden der Fehlermeldung:', e);
    }
  }
}

export async function handleStopRecordCommand(interaction: ChatInputCommandInteraction) {
  try {
    // Sofort bestätigen dass wir die Anfrage verarbeiten
    await interaction.reply('Stoppe Aufnahme...');

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.editReply('Du musst in einem Voice Channel sein um die Aufnahme zu stoppen.');
      return;
    }

    // Stoppe Aufnahme und warte auf Upload
    await interaction.editReply('Stoppe Aufnahme und lade Dateien hoch...');
    const { recording } = await voice.stopRecording({ channelId: voiceChannel.id });
    
    // Warte einen Moment um sicherzustellen, dass die Links verfügbar sind
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!recording.cloudLinks?.audio?.length) {
      await interaction.editReply('Keine Audiodateien wurden aufgenommen.');
      return;
    }
    
    // Formatiere Links für die Ausgabe
    const audioLinks = recording.cloudLinks.audio.map((link: string, i: number) => 
      `${i + 1}. ${link}`
    ).join('\n');

    const screenLinks = recording.cloudLinks.screen.length > 0 
      ? '\n\nScreen Aufnahmen:\n' + recording.cloudLinks.screen.map((link: string, i: number) => 
          `${i + 1}. ${link}`
        ).join('\n')
      : '';

    // Sende Erfolg in den Channel
    await voiceChannel.send({
      content: '⏹️ Aufnahme beendet!'
    });
    
    // Sende Links als separierte Nachricht
    await interaction.editReply({
      content: '📼 Audio Aufnahmen:\n' + audioLinks + screenLinks
    });

  } catch (error: any) {
    log.error('Fehler beim Stoppen der Aufnahme:', error);
    
    try {
      await interaction.editReply('❌ Fehler beim Stoppen der Aufnahme');
    } catch (e) {
      log.error('Fehler beim Senden der Fehlermeldung:', e);
    }
  }
}

export async function handleScreenCommand(interaction: ChatInputCommandInteraction) {
  try {
    // Sofort bestätigen dass wir die Anfrage verarbeiten
    await interaction.deferReply();

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.editReply('Du musst in einem Voice Channel sein um Recording zu aktivieren.');
      return;
    }

    // Toggle Screen Recording
    const { enabled } = await voice.toggleScreenRecording({ channelId: voiceChannel.id });
    
    await interaction.editReply(
      enabled ? 'Screen Recording aktiviert!' : 'Screen Recording deaktiviert!'
    );

  } catch (error: any) {
    log.error('Fehler beim Togglen des Screen Recordings:', error);
    
    // Versuche Fehlermeldung zu senden
    try {
      await interaction.editReply('Die Anwendung reagiert nicht');
    } catch (e) {
      log.error('Fehler beim Senden der Fehlermeldung:', e);
    }
  }
}

export async function handleHighlightCommand(interaction: ChatInputCommandInteraction) {
  try {
    // Sofort bestätigen dass wir die Anfrage verarbeiten
    await interaction.deferReply();

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.editReply('Du musst in einem Voice Channel sein um ein Highlight zu setzen.');
      return;
    }

    const description = interaction.options.getString('description', true);

    // Füge Highlight hinzu
    const { highlight } = await voice.addHighlight({ 
      channelId: voiceChannel.id,
      description,
      userId: member.id
    });
    
    await interaction.editReply(`Highlight gesetzt: ${description}`);

  } catch (error: any) {
    log.error('Fehler beim Setzen des Highlights:', error);
    
    // Versuche Fehlermeldung zu senden
    try {
      await interaction.editReply('Die Anwendung reagiert nicht');
    } catch (e) {
      log.error('Fehler beim Senden der Fehlermeldung:', e);
    }
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
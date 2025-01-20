import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { YouTubeChannel } from "../../youtube/types";
import * as youtubeAPI from "../../youtube/channels";
import * as youtubeDiscord from "../../youtube/discord";
import { extractChannelId, getChannelInfo } from "../../youtube/utils";

export const data = new SlashCommandBuilder()
    .setName("youtube")
    .setDescription("Verwalte YouTube-Kanal Benachrichtigungen")
    .addSubcommand(subcommand =>
        subcommand
            .setName("add")
            .setDescription("Füge einen YouTube-Kanal zur Überwachung hinzu")
            .addStringOption(option =>
                option
                    .setName("url")
                    .setDescription("Die URL des YouTube-Kanals")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("remove")
            .setDescription("Entferne einen YouTube-Kanal von der Überwachung")
            .addStringOption(option =>
                option
                    .setName("channel")
                    .setDescription("Der Name des Kanals")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("list")
            .setDescription("Liste alle überwachten YouTube-Kanäle auf")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("setchannel")
            .setDescription("Setze den Discord-Kanal für Benachrichtigungen")
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case "add": {
            await interaction.deferReply();
            const url = interaction.options.getString("url", true);
            
            try {
                // Extrahiere Channel ID und hole Kanal-Informationen
                const channelId = extractChannelId(url);
                const channelInfo = await getChannelInfo(channelId);
                
                await youtubeAPI.addChannel({
                    channelId: channelInfo.id,
                    name: channelInfo.name,
                    url: channelInfo.url
                });

                await interaction.editReply(`✅ Kanal **${channelInfo.name}** wurde zur Überwachung hinzugefügt!`);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unbekannter Fehler";
                await interaction.editReply(`❌ Fehler: ${message}`);
            }
            break;
        }

        case "remove": {
            await interaction.deferReply();
            const channelName = interaction.options.getString("channel", true);
            
            try {
                const channels = await youtubeAPI.listChannels();
                const channel = channels.find((c: YouTubeChannel) => c.name === channelName);
                
                if (!channel) {
                    await interaction.editReply("❌ Kanal nicht gefunden!");
                    return;
                }

                await youtubeAPI.removeChannel({ channelId: channel.id });
                await interaction.editReply(`✅ Kanal **${channelName}** wurde von der Überwachung entfernt!`);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unbekannter Fehler";
                await interaction.editReply(`❌ Fehler: ${message}`);
            }
            break;
        }

        case "list": {
            await interaction.deferReply();
            
            try {
                const channels = await youtubeAPI.listChannels();
                
                if (channels.length === 0) {
                    await interaction.editReply("Keine Kanäle in der Überwachung!");
                    return;
                }

                const channelList = channels
                    .map((c: YouTubeChannel) => `- **${c.name}** (${c.url})`)
                    .join("\n");

                await interaction.editReply(`📺 Überwachte Kanäle:\n${channelList}`);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unbekannter Fehler";
                await interaction.editReply(`❌ Fehler: ${message}`);
            }
            break;
        }

        case "setchannel": {
            await interaction.deferReply();
            
            try {
                await youtubeDiscord.setNotificationChannel({
                    channelId: interaction.channelId
                });

                await interaction.editReply("✅ Dieser Kanal wird nun für YouTube-Benachrichtigungen verwendet!");
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unbekannter Fehler";
                await interaction.editReply(`❌ Fehler: ${message}`);
            }
            break;
        }
    }
} 
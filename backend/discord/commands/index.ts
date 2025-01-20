import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { recordingCommands, handleRecordCommand, handleStopRecordCommand, handleScreenCommand, handleHighlightCommand } from './recording';
import { youtubeCommands, handleYoutubeCommand } from './youtube';

export const commands: (SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder)[] = [
    ...recordingCommands,
    ...youtubeCommands
];

export const handlers = {
    record: handleRecordCommand,
    stoprecord: handleStopRecordCommand,
    screen: handleScreenCommand,
    highlight: handleHighlightCommand,
    youtube: handleYoutubeCommand
}; 
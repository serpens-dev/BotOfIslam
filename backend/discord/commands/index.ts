import { recordingCommands } from './recording';
import { youtubeCommands } from './youtube';
import { Command } from './types';

// Exportiere alle Commands als ein Array
export const commands: Command[] = [
    ...recordingCommands,
    ...youtubeCommands
]; 
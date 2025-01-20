import { recordingCommands } from './recording';
import { youtubeCommands } from './youtube';
import { Command } from './types';

export const commands: Command[] = [
    ...recordingCommands,
    ...youtubeCommands
]; 
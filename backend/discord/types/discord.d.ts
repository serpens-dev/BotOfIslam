import { Client, ClientEvents } from 'discord.js';

declare module 'discord.js' {
  export interface Client {
    once<K extends keyof ClientEvents>(
      event: K,
      listener: (...args: ClientEvents[K]) => void
    ): this;
  }
} 
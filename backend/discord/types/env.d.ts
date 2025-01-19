declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GUILD_ID: string;
      NOTIFICATION_CHANNEL_ID: string;
    }
  }
}

export {}; 
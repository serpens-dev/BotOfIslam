import { api } from "encore.dev/api";
import { startBot } from './bot';
import log from "encore.dev/log";

// Debug-Endpunkt zum Starten des Bots
export const startDiscordBot = api(
    { 
        expose: true,
        method: "GET",
        path: "/discord/start"
    },
    async () => {
        log.info("API: Versuche Bot zu starten...");
        try {
            await startBot();
            return { status: "Bot gestartet" };
        } catch (error) {
            log.error("API: Fehler beim Starten des Bots:", error);
            throw error;
        }
    }
); 
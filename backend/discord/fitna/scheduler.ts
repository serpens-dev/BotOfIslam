import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { client } from '../bot';
import { checkAndMuteTopFitna } from './muteSystem';
import log from "encore.dev/log";

// Erstelle einen API-Endpoint für den Cron Job
export const checkFitnaPoints = api({}, async () => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID!);
    if (guild) {
      await checkAndMuteTopFitna(guild);
    }
  } catch (error) {
    log.error("Fehler beim Prüfen der Fitna-Punkte", { error });
  }
});

// Erstelle den Cron Job
const _ = new CronJob("check-fitna-points", {
  title: "Prüfe Fitna-Punkte",
  schedule: "0 0 * * *", // Jeden Tag um Mitternacht
  endpoint: checkFitnaPoints
}); 
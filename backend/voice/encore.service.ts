import { Service } from "encore.dev/service";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Voice Service Datenbank für Aufnahmen und Highlights
export const VoiceDB = new SQLDatabase("voice", {
  migrations: "./migrations"
});

// Voice Service
export default new Service("voice");

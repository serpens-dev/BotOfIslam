import { SQLDatabase } from "encore.dev/storage/sqldb";

export const db = new SQLDatabase("discord_points", {
  migrations: {
    path: "./migrations"
  }
}); 
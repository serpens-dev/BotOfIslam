import { db } from '../db';
import log from "encore.dev/log";

interface UserPoints {
  userId: string;
  points: number;
  lastUpdated: Date;
}

export async function addPoints(userId: string, points: number): Promise<void> {
  try {
    await db.exec`
      INSERT INTO user_points (user_id, points)
      VALUES (${userId}, ${points})
      ON CONFLICT (user_id)
      DO UPDATE SET points = user_points.points + ${points},
                    last_updated = CURRENT_TIMESTAMP
    `;
    log.info("Punkte hinzugefügt", { userId, points });
  } catch (error) {
    log.error("Fehler beim Hinzufügen von Punkten", { userId, error });
    throw error;
  }
}

export async function getPoints(userId: string): Promise<number> {
  try {
    const result = await db.queryRow<UserPoints>`
      SELECT points FROM user_points 
      WHERE user_id = ${userId}
    `;
    return result?.points || 0;
  } catch (error) {
    log.error("Fehler beim Abrufen der Punkte", { userId, error });
    throw error;
  }
} 
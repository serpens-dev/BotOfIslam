import { EmbedBuilder, User } from 'discord.js';
import { db } from '../db';
import log from "encore.dev/log";

interface FitnaStats {
  totalPoints: number;
  monthlyAverage: number;
  mostPointsFrom: string;
  mostPointsGivenTo: string;
  longestStreak: number;
  timesMuted: number;
}

export async function getUserStats(userId: string): Promise<FitnaStats> {
  try {
    // Gesamtpunkte
    const totalPoints = await db.queryRow<{count: number}>`
      SELECT COUNT(*) as count FROM fitna_points 
      WHERE user_id = ${userId}
    `;

    // Wer gibt die meisten Punkte
    const topGiver = await db.queryRow<{given_by: string; count: number}>`
      SELECT given_by, COUNT(*) as count 
      FROM fitna_points 
      WHERE user_id = ${userId}
      GROUP BY given_by 
      ORDER BY count DESC 
      LIMIT 1
    `;

    // Anzahl der Mutes
    const muteCount = await db.queryRow<{count: number}>`
      SELECT COUNT(*) as count FROM mute_history 
      WHERE user_id = ${userId}
    `;

    // Monatlicher Durchschnitt
    const monthlyAvg = await db.queryRow<{avg: number}>`
      SELECT AVG(monthly_count) as avg
      FROM (
        SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as monthly_count
        FROM fitna_points
        WHERE user_id = ${userId}
        GROUP BY DATE_TRUNC('month', created_at)
      ) as monthly_stats
    `;

    return {
      totalPoints: totalPoints?.count || 0,
      monthlyAverage: Math.round((monthlyAvg?.avg || 0) * 10) / 10,
      mostPointsFrom: topGiver?.given_by || 'Niemand',
      mostPointsGivenTo: 'TODO',
      longestStreak: 0, // TODO
      timesMuted: muteCount?.count || 0
    };
  } catch (error) {
    log.error("Fehler beim Abrufen der Fitna-Statistiken", { error });
    throw error;
  }
} 
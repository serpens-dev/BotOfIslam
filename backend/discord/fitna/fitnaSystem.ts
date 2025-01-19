import { EmbedBuilder, User, GuildMember } from 'discord.js';
import log from "encore.dev/log";
import { db } from '../db';

interface FitnaPoint {
  id: number;
  userId: string;
  givenBy: string;
  points: number;
  reason?: string;
  createdAt: Date;
}

const Messages = [
  "Fitna-Punkt wurde verteilt!",
  "Abow da hat jemand einen Fitna-Punkt verdient",
  "Lak hör auf mit der Fitna",
  "Noch mehr Fitna, wer hat es angezettelt? Warst du es Tim?",
  "tmm bruder reicht jetzt mit der Fitna yau"
  
];

export async function giveFitnaPoint(userId: string, givenBy: string, reason?: string): Promise<void> {
  try {
    // Prüfe Aktivität
    const isActive = await checkUserActivity(userId);
    if (!isActive) {
      throw new Error("Dieser User ist nicht aktiv genug für Fitna-Punkte! (Min. 200 Nachrichten/Monat)");
    }

    // Prüfe Cooldown
    const lastGiven = await db.queryRow<{last_given_at: Date}>`
      SELECT last_given_at FROM point_cooldowns 
      WHERE user_id = ${givenBy}
    `;

    if (lastGiven) {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      if (lastGiven.last_given_at > twoWeeksAgo) {
        throw new Error("Du kannst erst in 2 Wochen wieder einen Fitna-Punkt vergeben!");
      }
    }

    // Füge Punkt hinzu mit NULL wenn kein Grund angegeben wurde
    await db.exec`
      INSERT INTO fitna_points (user_id, given_by, reason)
      VALUES (${userId}, ${givenBy}, ${reason || null})
    `;

    // Aktualisiere Cooldown
    await db.exec`
      INSERT INTO point_cooldowns (user_id, last_given_at)
      VALUES (${givenBy}, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET last_given_at = CURRENT_TIMESTAMP
    `;

    log.info("Fitna Punkt vergeben", { userId, givenBy, reason });
  } catch (error) {
    log.error("Fehler beim Vergeben des Fitna-Punkts", { error });
    throw error;
  }
}

export async function getFitnaPoints(userId: string): Promise<number> {
  try {
    const result = await db.queryRow<{count: number}>`
      SELECT COUNT(*) as count FROM fitna_points 
      WHERE user_id = ${userId}
      AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
    `;
    return result?.count || 0;
  } catch (error) {
    log.error("Fehler beim Abrufen der Fitna-Punkte", { error });
    throw error;
  }
}

export async function getFitnaLeaderboard(timeframe: 'month' | 'all'): Promise<{userId: string; points: number}[]> {
  try {
    const timeCondition = timeframe === 'month' 
      ? 'AND created_at >= date_trunc(\'month\', CURRENT_TIMESTAMP)'
      : '';

    const leaders = await db.query<{user_id: string; points: number}>`
      SELECT user_id, COUNT(*) as points 
      FROM fitna_points 
      WHERE 1=1 ${timeCondition}
      GROUP BY user_id 
      ORDER BY points DESC 
      LIMIT 5
    `;

    const result = [];
    for await (const leader of leaders) {
      result.push({
        userId: leader.user_id,
        points: Number(leader.points)
      });
    }
    return result;
  } catch (error) {
    log.error("Fehler beim Abrufen des Leaderboards", { error });
    throw error;
  }
}

export function createLeaderboardEmbed(leaders: {userId: string; points: number}[], users: User[], timeframe: string) {
  const embed = new EmbedBuilder()
    .setColor('#FF4444')
    .setTitle('🏆 Fitna Leaderboard')
    .setDescription(`Top 5 Fitna-Sammler ${timeframe === 'month' ? 'diesen Monat' : 'aller Zeiten'}`)
    .setTimestamp();

  leaders.forEach((leader, index) => {
    const user = users.find(u => u.id === leader.userId);
    if (user) {
      embed.addFields({
        name: `${getMedalEmoji(index + 1)} ${user.username}`,
        value: `${leader.points} Fitna-Punkte`,
        inline: false
      });
    }
  });

  return embed;
}

function getMedalEmoji(position: number): string {
  switch (position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${position}.`;
  }
}

export function getRandomMessage(): string {
  return Messages[Math.floor(Math.random() * Messages.length)];
}

// Admin/Mod Funktionen
export async function modifyFitnaPoints(userId: string, amount: number, modId: string): Promise<void> {
  try {
    if (amount > 0) {
      for (let i = 0; i < amount; i++) {
        await db.exec`
          INSERT INTO fitna_points (user_id, given_by, reason)
          VALUES (${userId}, ${modId}, 'Moderator Aktion')
        `;
      }
    } else {
      await db.exec`
        DELETE FROM fitna_points 
        WHERE user_id = ${userId} 
        AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
        LIMIT ${Math.abs(amount)}
      `;
    }
    
    log.info("Fitna Punkte modifiziert", { userId, amount, modId });
  } catch (error) {
    log.error("Fehler bei der Modifikation von Fitna-Punkten", { error });
    throw error;
  }
}

// Neue Funktion für detaillierte Punktehistorie
export async function getFitnaHistory(userId: string): Promise<FitnaPoint[]> {
  try {
    const history = await db.query<FitnaPoint>`
      SELECT 
        fp.id,
        fp.user_id as "userId",
        fp.given_by as "givenBy",
        1 as points,
        fp.reason,
        fp.created_at as "createdAt"
      FROM fitna_points fp
      WHERE fp.user_id = ${userId}
      ORDER BY fp.created_at DESC
      LIMIT 10
    `;

    const result = [];
    for await (const point of history) {
      result.push(point);
    }
    return result;
  } catch (error) {
    log.error("Fehler beim Abrufen der Fitna-Historie", { error });
    throw error;
  }
}

// Funktion für Rollen-Check
export async function hasRequiredRole(member: GuildMember): Promise<boolean> {
  return member.roles.cache.some(role => role.name === "✊Vertrauenswürdig");
}

// Neue Funktion zur Aktivitätsprüfung
export async function checkUserActivity(userId: string): Promise<boolean> {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1); // Erster Tag des Monats
    
    const activity = await db.queryRow<{message_count: number}>`
      SELECT message_count 
      FROM user_activity 
      WHERE user_id = ${userId} 
      AND tracked_month = ${currentMonth}
    `;

    // Mindestens 50 Nachrichten pro Woche -> ~200 pro Monat
    return (activity?.message_count ?? 0) >= 200;
  } catch (error) {
    log.error("Fehler beim Prüfen der User-Aktivität", { error });
    return false;
  }
} 
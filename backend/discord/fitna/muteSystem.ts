import { Guild, GuildMember } from 'discord.js';
import { db } from '../db';
import log from "encore.dev/log";
import { getFitnaPoints } from './fitnaSystem';

export async function checkAndMuteTopFitna(guild: Guild): Promise<void> {
  try {
    // Prüfe ob es der erste Tag des Monats ist
    const today = new Date();
    if (today.getDate() !== 1) return;

    // Hole Top Fitna User des letzten Monats
    const lastMonthTopUser = await db.queryRow<{user_id: string; points: number}>`
      SELECT user_id, COUNT(*) as points 
      FROM fitna_points 
      WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP - interval '1 month')
      AND created_at < date_trunc('month', CURRENT_TIMESTAMP)
      GROUP BY user_id 
      ORDER BY points DESC 
      LIMIT 1
    `;

    if (!lastMonthTopUser) return;

    const member = await guild.members.fetch(lastMonthTopUser.user_id);
    if (!member) return;

    // Mute für 24 Stunden
    await member.timeout(24 * 60 * 60 * 1000, 'Höchste Fitna-Punkte des Monats');
    
    // Speichere in Historie
    await db.exec`
      INSERT INTO mute_history (user_id, points_count, muted_at)
      VALUES (${lastMonthTopUser.user_id}, ${lastMonthTopUser.points}, CURRENT_TIMESTAMP)
    `;

    // Sende Benachrichtigung
    const channel = await guild.channels.fetch(process.env.NOTIFICATION_CHANNEL_ID!);
    if (channel?.isTextBased()) {
      await channel.send(
        `👮 ${member.user.username} wurde für 24 Stunden gemuted!\n` +
        `Grund: Höchste Fitna-Punkte (${lastMonthTopUser.points}) im letzten Monat 📊`
      );
    }

    log.info("User gemuted wegen Fitna", { 
      userId: lastMonthTopUser.user_id, 
      points: lastMonthTopUser.points 
    });
  } catch (error) {
    log.error("Fehler beim Muten des Top Fitna Users", { error });
  }
} 
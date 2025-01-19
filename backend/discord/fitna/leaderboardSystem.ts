import { EmbedBuilder, User } from 'discord.js';
import { SQLDatabase } from "encore.dev/storage/sqldb";
import log from "encore.dev/log";
import { getFitnaLeaderboard } from './fitnaSystem';

interface LeaderboardEntry {
  userId: string;
  points: number;
  rank: number;
  avatar: string;
}

function getMedalEmoji(position: number): string {
  switch (position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${position}.`;
  }
}

export async function getDetailedLeaderboard(timeframe: 'month' | 'all', users: User[]): Promise<EmbedBuilder> {
  const leaders = await getFitnaLeaderboard(timeframe);
  const embed = new EmbedBuilder()
    .setColor('#FF4444')
    .setTitle('🏆 Fitna Leaderboard')
    .setDescription(`Top 5 Fitna-Sammler ${timeframe === 'month' ? 'diesen Monat' : 'aller Zeiten'}`)
    .setTimestamp();

  for (const [index, leader] of leaders.entries()) {
    const user = users.find(u => u.id === leader.userId);
    if (user) {
      embed.addFields({
        name: `${getMedalEmoji(index + 1)} ${user.username}`,
        value: `${leader.points} Fitna-Punkte`,
        inline: false
      })
      .setThumbnail(user.displayAvatarURL());
    }
  }

  return embed;
} 
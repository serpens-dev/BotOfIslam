import { EmbedBuilder } from 'discord.js';
import { SQLDatabase } from "encore.dev/storage/sqldb";
import log from "encore.dev/log";
import { getUserStats } from './statsSystem';
import { db } from '../db';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: any) => boolean;
}

const achievements: Achievement[] = [
  {
    id: 'first_blood',
    name: 'Erste Fitna',
    description: 'Erhalte deinen ersten Fitna-Punkt',
    icon: '🎯',
    condition: (stats) => stats.totalPoints >= 1
  },
  {
    id: 'fitna_master',
    name: 'Fitna-Meister',
    description: 'Sammle 50 Fitna-Punkte',
    icon: '👑',
    condition: (stats) => stats.totalPoints >= 50
  },
  {
    id: 'silence_breaker',
    name: 'Stille-Brecher',
    description: 'Werde 5 Mal gemuted',
    icon: '🤐',
    condition: (stats) => stats.timesMuted >= 5
  },
  // ... weitere Achievements
];

export async function checkAchievements(userId: string): Promise<Achievement[]> {
  try {
    // Hole die Statistiken des Users
    const stats = await getUserStats(userId);
    
    // Prüfe welche Achievements erfüllt sind
    const unlockedAchievements = achievements.filter(achievement => 
      achievement.condition(stats)
    );

    return unlockedAchievements;
  } catch (error) {
    log.error("Fehler beim Prüfen der Achievements", { error });
    return [];
  }
} 
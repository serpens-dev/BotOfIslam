import { GuildMember } from 'discord.js';
import { db } from './db';

export async function addPoints(userId: string, amount: number) {
  await db.exec`
    INSERT INTO user_points (user_id, points)
    VALUES (${userId}, ${amount})
    ON CONFLICT (user_id) 
    DO UPDATE SET points = user_points.points + ${amount}
  `;
}

export async function getPoints(userId: string): Promise<number> {
  const result = await db.queryRow<{points: number}>`
    SELECT COALESCE(points, 0) as points 
    FROM user_points 
    WHERE user_id = ${userId}
  `;
  return result?.points || 0;
}

export async function hasRequiredRole(member: GuildMember): Promise<boolean> {
  const requiredRoleName = 'Vertrauenswürdig';
  return member.roles.cache.some(role => role.name === requiredRoleName);
} 
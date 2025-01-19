interface Punishment {
  type: 'mute' | 'role' | 'nickname';
  duration: number;
  condition: (points: number) => boolean;
}

const punishments: Punishment[] = [
  {
    type: 'mute',
    duration: 24 * 60 * 60 * 1000, // 24 Stunden
    condition: (points) => points >= 10
  },
  {
    type: 'role',
    duration: 7 * 24 * 60 * 60 * 1000, // 1 Woche
    condition: (points) => points >= 20
  }
]; 
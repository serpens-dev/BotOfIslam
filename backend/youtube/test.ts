import { FeedUpdate } from './types';

const testUpdate: FeedUpdate = {
  videoId: "test-video-123",
  title: "Test Video Titel",
  description: "Dies ist ein Test-Video zur Überprüfung der Benachrichtigungen",
  channelId: "UCzsd4-oyHhNbAXfceOQ5HTw", // Ersetze dies mit der tatsächlichen Channel ID
  publishedAt: new Date().toISOString(),
  thumbnailUrl: "https://i.ytimg.com/vi/test-video-123/maxresdefault.jpg"
};

async function sendTestNotification() {
  try {
    const response = await fetch('http://localhost:4000/youtube/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUpdate)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Test-Benachrichtigung erfolgreich gesendet!');
  } catch (error) {
    console.error('Fehler beim Senden der Test-Benachrichtigung:', error);
  }
}

// Führe den Test aus
sendTestNotification(); 
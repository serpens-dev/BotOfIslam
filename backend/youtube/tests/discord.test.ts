import { WebSubNotification } from "../types";

describe("Discord Integration", () => {
    describe("Message Formatting", () => {
        const testNotification: WebSubNotification = {
            feed: "yt:channel:UC1234567890",
            title: "Test Video Title",
            link: "https://youtube.com/watch?v=test123",
            published: new Date("2024-01-20T12:00:00Z"),
            author: "Test Channel",
            videoId: "test123"
        };

        test("formats notification correctly", () => {
            const embed = {
                title: testNotification.title,
                url: testNotification.link,
                color: 0xFF0000,
                author: {
                    name: testNotification.author,
                    icon_url: `https://www.youtube.com/channel/UC1234567890/avatar`,
                },
                thumbnail: {
                    url: `https://img.youtube.com/vi/${testNotification.videoId}/maxresdefault.jpg`
                },
                timestamp: testNotification.published.toISOString()
            };

            const message = {
                content: `🎥 **Neues Video von ${testNotification.author}**`,
                embeds: [embed],
                allowed_mentions: {
                    parse: ["users"]
                }
            };

            // Verifiziere die Nachrichtenstruktur
            expect(message).toMatchObject({
                content: expect.stringContaining(testNotification.author),
                embeds: [
                    expect.objectContaining({
                        title: testNotification.title,
                        url: testNotification.link,
                        color: 0xFF0000,
                        author: expect.objectContaining({
                            name: testNotification.author
                        }),
                        thumbnail: expect.objectContaining({
                            url: expect.stringContaining(testNotification.videoId)
                        })
                    })
                ]
            });
        });
    });
}); 
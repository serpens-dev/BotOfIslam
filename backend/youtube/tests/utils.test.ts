import { extractChannelId } from "../utils";

describe("YouTube Utils", () => {
    describe("extractChannelId", () => {
        test("extracts ID from /channel/ URL", () => {
            const url = "https://youtube.com/channel/UC1234567890";
            expect(extractChannelId(url)).toBe("UC1234567890");
        });

        test("extracts ID from /c/ URL", () => {
            const url = "https://youtube.com/c/TestChannel";
            expect(extractChannelId(url)).toBe("TestChannel");
        });

        test("extracts ID from /@ URL", () => {
            const url = "https://youtube.com/@TestChannel";
            expect(extractChannelId(url)).toBe("TestChannel");
        });

        test("extracts ID from /user/ URL", () => {
            const url = "https://youtube.com/user/TestChannel";
            expect(extractChannelId(url)).toBe("TestChannel");
        });

        test("throws error for invalid URL", () => {
            const url = "https://youtube.com/invalid/url";
            expect(() => extractChannelId(url)).toThrow("Ungültige YouTube-Kanal URL");
        });
    });
}); 
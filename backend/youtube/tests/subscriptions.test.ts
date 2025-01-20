import { verifySignature } from "../subscriptions";
import crypto from "crypto";

describe("YouTube Subscriptions", () => {
    describe("verifySignature", () => {
        const testSecret = "test-secret";
        const testBody = Buffer.from("test-body");
        
        test("verifies valid signature", () => {
            // Erstelle eine gültige Signatur
            const validSignature = "sha1=" + crypto
                .createHmac("sha1", testSecret)
                .update(testBody)
                .digest("hex");

            expect(verifySignature(testBody, validSignature, testSecret)).toBe(true);
        });

        test("rejects invalid signature", () => {
            const invalidSignature = "sha1=invalid";
            expect(verifySignature(testBody, invalidSignature, testSecret)).toBe(false);
        });

        test("rejects missing signature", () => {
            expect(verifySignature(testBody, undefined, testSecret)).toBe(false);
        });

        test("rejects wrong secret", () => {
            const validSignature = "sha1=" + crypto
                .createHmac("sha1", testSecret)
                .update(testBody)
                .digest("hex");

            expect(verifySignature(testBody, validSignature, "wrong-secret")).toBe(false);
        });
    });
}); 
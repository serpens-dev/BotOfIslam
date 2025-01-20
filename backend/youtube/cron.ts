import { CronJob } from "encore.dev/cron";
import * as subscriptions from "./subscriptions";

// Erneuere Subscriptions stündlich
export const renewSubscriptionsCron = new CronJob("renew-youtube-subscriptions", {
    title: "Erneuere YouTube WebSub Subscriptions",
    every: "1h",
    endpoint: subscriptions.renewSubscriptions
}); 
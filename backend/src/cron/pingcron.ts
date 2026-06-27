// import cron from "node-cron";
//
// const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
//
// // Runs every 5 minutes
// export function startKeepAliveCron(): void {
//     cron.schedule("*/5 * * * *", pingServer);
//     console.log("Keep-alive cron scheduled — pinging every 5 minutes");
// }
//
// async function pingServer(): Promise<void> {
//     try {
//         const res = await fetch(`${BACKEND_URL}/health`);
//         const data = await res.json();
//         if (!data) throw new Error("no data from health endpoint")
//         // @ts-ignore
//         console.log(`[keep-alive] ping ok — ${data.timestamp}`);
//     } catch (error) {
//         console.error("[keep-alive] ping failed:", error);
//     }
// }

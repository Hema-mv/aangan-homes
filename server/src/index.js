import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));
// --port wins over PORT so the dev script can stay on 4000 even when a tool sets PORT for the web server.
const { values: args } = parseArgs({ options: { port: { type: "string" } }, strict: false });
const PORT = Number(args.port ?? process.env.PORT ?? 4000);
const DB_FILE = process.env.DB_FILE ?? resolve(here, "../data/aangan.db");

const db = openDb(DB_FILE);
const { app, live } = createApp({ db, staticDir: resolve(here, "../../client/dist") });

const server = app.listen(PORT, () => console.log(`Aangan API listening on http://localhost:${PORT}`));

function shutdown() {
  live.closeAll();
  server.close(() => { db.close(); process.exit(0); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

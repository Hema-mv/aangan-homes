// Deletes the local database and recreates it with sample data: `npm run seed -w server`.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { openDb } from "./db.js";

const file = process.env.DB_FILE ?? resolve(dirname(fileURLToPath(import.meta.url)), "../data/aangan.db");
for (const f of [file, file + "-wal", file + "-shm"]) rmSync(f, { force: true });
openDb(file).close();
console.log("Database reset:", file);

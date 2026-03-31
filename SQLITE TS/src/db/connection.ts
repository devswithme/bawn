// To connect with SQLite

import Database from "better-sqlite3";

const db: Database.Database = new Database("database.sqlite");

db.pragma("journal_mode = WAL"); // increases performance

export default db;
import db from "./connection";
import * as fs from "fs";

const sql = fs.readFileSync("src/db/migrations/init.sql", "utf8");
db.exec(sql);

console.log("Database initialized successfully!");
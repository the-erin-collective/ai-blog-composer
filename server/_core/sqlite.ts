import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a local SQLite database file
const dbPath = path.join(process.cwd(), 'data', 'dev.db');

// Create data directory if it doesn't exist
import fs from 'fs';
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

// Run migrations on startup
function runMigrations() {
  try {
    const migrationsFolder = path.join(__dirname, '../../drizzle');
    migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL');

// Export the database instance and migration function
export { db, sqlite, runMigrations };

export async function getDb() {
  return db;
}

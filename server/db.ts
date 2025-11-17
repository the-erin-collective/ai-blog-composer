import { eq } from "drizzle-orm";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { db as sqliteDb, sqlite, runMigrations } from './_core/sqlite';
import { drizzle } from 'drizzle-orm/better-sqlite3';

// In development, use SQLite
let _db: ReturnType<typeof drizzle> | null = null;

// Initialize the database connection
export async function getDb() {
  if (!_db) {
    if (process.env.NODE_ENV === 'development' || !process.env.DATABASE_URL) {
      // Use SQLite in development
      console.log('[Database] Using SQLite database');
      _db = sqliteDb;
      try {
        await runMigrations();
      } catch (error) {
        console.error('Failed to run migrations:', error);
      }
    } else {
      // Use production database if DATABASE_URL is provided
      console.log('[Database] Using production database');
      try {
        const { default: mysql } = await import('mysql2/promise');
        const connection = await mysql.createConnection(process.env.DATABASE_URL);
        _db = drizzle(connection);
      } catch (error) {
        console.warn("[Database] Failed to connect:", error);
        _db = null;
      }
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Pipeline execution state management
export {
  createPipelineExecution,
  updatePipelineExecution,
  getPipelineExecution,
  addAuditLogEntry,
  type PipelineInput,
  type PipelineContext,
  type SuspensionData,
  type PipelineMetrics,
  type PipelineStatus,
} from './pipelineState';

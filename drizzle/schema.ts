import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Pipeline executions table for tracking content generation workflows.
 * Stores execution state, context, and suspension information for human approval gates.
 */
export const pipelineExecutions = mysqlTable(
  "pipelineExecutions",
  {
    /**
     * Surrogate primary key. Auto-incremented numeric value managed by the database.
     */
    id: int("id").autoincrement().primaryKey(),
    
    /**
     * Unique execution identifier (nanoid). Used for API references and tracking.
     */
    executionId: varchar("executionId", { length: 64 }).notNull().unique(),
    
    /**
     * Current workflow status.
     * - running: Workflow is actively executing
     * - suspended: Workflow is paused at a human gate awaiting approval
     * - completed: Workflow finished successfully
     * - rejected: Workflow was rejected by human reviewer
     * - failed: Workflow encountered an error
     */
    status: mysqlEnum("status", ["running", "suspended", "completed", "rejected", "failed"])
      .notNull()
      .default("running"),
    
    /**
     * Input data for the pipeline (JSON).
     * Contains: { competitorUrl: string, editorId: string }
     */
    input: text("input").notNull(),
    
    /**
     * Workflow execution context (JSON).
     * Contains intermediate results: metadata, concepts, outline, draft, scores, etc.
     */
    context: text("context"),
    
    /**
     * Suspension metadata (JSON) when workflow is paused at human gates.
     * Contains: { suspendedAt: string, reason: string, stepId: string, data: object }
     */
    suspension: text("suspension"),
    
    /**
     * Metrics and audit information (JSON).
     * Contains: startedAt, completedAt, totalCost, tokenUsage, auditLog
     */
    metrics: text("metrics"),
    
    /**
     * Timestamp when the execution was created.
     */
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    
    /**
     * Timestamp when the execution was last updated.
     */
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    // Index on executionId for fast lookups by execution ID
    executionIdIdx: index("executionId_idx").on(table.executionId),
    // Index on status for filtering by workflow state
    statusIdx: index("status_idx").on(table.status),
  })
);

export type PipelineExecution = typeof pipelineExecutions.$inferSelect;
export type InsertPipelineExecution = typeof pipelineExecutions.$inferInsert;
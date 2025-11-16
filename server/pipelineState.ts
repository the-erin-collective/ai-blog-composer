import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { InsertPipelineExecution, pipelineExecutions, PipelineExecution } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Input data for creating a new pipeline execution.
 */
export interface PipelineInput {
  competitorUrl: string;
  editorId: string;
}

/**
 * Workflow execution context containing intermediate results.
 */
export interface PipelineContext {
  metadata?: {
    title: string;
    metaDescription: string;
    headings: {
      h1: string[];
      h2: string[];
      h3: string[];
    };
    extractedAt: string;
  };
  concepts?: string[];
  outline?: {
    title: string;
    introduction: string[];
    sections: Array<{
      heading: string;
      keyPoints: string[];
    }>;
    conclusion: string[];
  };
  draft?: {
    title: string;
    metaDescription: string;
    bodyParagraphs: string[];
    wordCount: number;
  };
  reviewScore?: number;
  distinctivenessScore?: number;
  revisionCount?: number;
  html?: string;
}

/**
 * Suspension metadata when workflow is paused at human gates.
 */
export interface SuspensionData {
  suspendedAt: string;
  reason: string;
  stepId: string;
  data: Record<string, any>;
}

/**
 * Metrics and audit information for pipeline execution.
 */
export interface PipelineMetrics {
  startedAt: string;
  completedAt?: string;
  totalCost?: number;
  tokenUsage?: {
    summarizer?: number;
    outline?: number;
    draft?: number;
    reviewer?: number;
  };
  auditLog?: Array<{
    timestamp: string;
    event: string;
    stepId: string;
    data: Record<string, any>;
  }>;
}

/**
 * Pipeline execution status type.
 */
export type PipelineStatus = "running" | "suspended" | "completed" | "rejected" | "failed";

/**
 * Create a new pipeline execution in the database.
 * 
 * @param input - The input data for the pipeline (competitorUrl, editorId)
 * @returns The created pipeline execution with generated executionId
 * @throws Error if database is not available or insertion fails
 * 
 * Requirements: 1.3, 10.2
 */
export async function createPipelineExecution(input: PipelineInput): Promise<PipelineExecution> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const executionId = nanoid();
  const now = new Date().toISOString();

  const metrics: PipelineMetrics = {
    startedAt: now,
    auditLog: [
      {
        timestamp: now,
        event: "PIPELINE_INITIALIZED",
        stepId: "init",
        data: { input },
      },
    ],
  };

  const values: InsertPipelineExecution = {
    executionId,
    status: "running",
    input: JSON.stringify(input),
    context: JSON.stringify({}),
    metrics: JSON.stringify(metrics),
  };

  try {
    await db.insert(pipelineExecutions).values(values);

    // Retrieve the created execution
    const result = await db
      .select()
      .from(pipelineExecutions)
      .where(eq(pipelineExecutions.executionId, executionId))
      .limit(1);

    if (result.length === 0) {
      throw new Error("Failed to retrieve created execution");
    }

    return result[0];
  } catch (error) {
    console.error("[PipelineState] Failed to create execution:", error);
    throw error;
  }
}

/**
 * Update an existing pipeline execution state.
 * 
 * @param executionId - The unique execution identifier
 * @param updates - Partial updates to apply to the execution
 * @returns The updated pipeline execution
 * @throws Error if database is not available, execution not found, or update fails
 * 
 * Requirements: 1.3, 10.2
 */
export async function updatePipelineExecution(
  executionId: string,
  updates: {
    status?: PipelineStatus;
    context?: PipelineContext;
    suspension?: SuspensionData | null;
    metrics?: PipelineMetrics;
  }
): Promise<PipelineExecution> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    // First, retrieve the current execution to merge updates
    const current = await getPipelineExecution(executionId);
    if (!current) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Prepare update values
    const updateValues: Partial<InsertPipelineExecution> = {};

    if (updates.status !== undefined) {
      updateValues.status = updates.status;
    }

    if (updates.context !== undefined) {
      // Merge with existing context
      const existingContext = current.context ? JSON.parse(current.context) : {};
      const mergedContext = { ...existingContext, ...updates.context };
      updateValues.context = JSON.stringify(mergedContext);
    }

    if (updates.suspension !== undefined) {
      updateValues.suspension = updates.suspension ? JSON.stringify(updates.suspension) : null;
    }

    if (updates.metrics !== undefined) {
      // Merge with existing metrics
      const existingMetrics = current.metrics ? JSON.parse(current.metrics) : {};
      const mergedMetrics = { ...existingMetrics, ...updates.metrics };
      
      // Merge audit logs if present
      if (updates.metrics.auditLog && existingMetrics.auditLog) {
        mergedMetrics.auditLog = [...existingMetrics.auditLog, ...updates.metrics.auditLog];
      }
      
      updateValues.metrics = JSON.stringify(mergedMetrics);
    }

    // Perform the update
    await db
      .update(pipelineExecutions)
      .set(updateValues)
      .where(eq(pipelineExecutions.executionId, executionId));

    // Retrieve and return the updated execution
    const result = await db
      .select()
      .from(pipelineExecutions)
      .where(eq(pipelineExecutions.executionId, executionId))
      .limit(1);

    if (result.length === 0) {
      throw new Error("Failed to retrieve updated execution");
    }

    return result[0];
  } catch (error) {
    console.error("[PipelineState] Failed to update execution:", error);
    throw error;
  }
}

/**
 * Retrieve a pipeline execution by its execution ID.
 * 
 * @param executionId - The unique execution identifier
 * @returns The pipeline execution or undefined if not found
 * @throws Error if database is not available or query fails
 * 
 * Requirements: 1.3, 10.2
 */
export async function getPipelineExecution(executionId: string): Promise<PipelineExecution | undefined> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db
      .select()
      .from(pipelineExecutions)
      .where(eq(pipelineExecutions.executionId, executionId))
      .limit(1);

    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[PipelineState] Failed to retrieve execution:", error);
    throw error;
  }
}

/**
 * Add an audit log entry to a pipeline execution.
 * 
 * @param executionId - The unique execution identifier
 * @param event - The event name
 * @param stepId - The workflow step identifier
 * @param data - Additional event data
 */
export async function addAuditLogEntry(
  executionId: string,
  event: string,
  stepId: string,
  data: Record<string, any> = {}
): Promise<void> {
  const execution = await getPipelineExecution(executionId);
  if (!execution) {
    throw new Error(`Execution not found: ${executionId}`);
  }

  const existingMetrics = execution.metrics ? JSON.parse(execution.metrics) : {};
  const auditLog = existingMetrics.auditLog || [];

  auditLog.push({
    timestamp: new Date().toISOString(),
    event,
    stepId,
    data,
  });

  await updatePipelineExecution(executionId, {
    metrics: {
      ...existingMetrics,
      auditLog,
    },
  });
}

/**
 * Save suspension state for a pipeline execution.
 * Updates the execution status to 'suspended' and stores suspension metadata.
 * 
 * @param executionId - The unique execution identifier
 * @param reason - Human-readable reason for suspension (e.g., "Waiting for concept approval")
 * @param stepId - The workflow step identifier where suspension occurred
 * @param data - Additional suspension data (e.g., concepts to review, draft content)
 * @returns The updated pipeline execution
 * @throws Error if database is not available or execution not found
 * 
 * Requirements: 4.1, 8.1
 */
export async function saveSuspensionState(
  executionId: string,
  reason: string,
  stepId: string,
  data: Record<string, any>
): Promise<PipelineExecution> {
  const suspensionData: SuspensionData = {
    suspendedAt: new Date().toISOString(),
    reason,
    stepId,
    data,
  };

  // Add audit log entry for suspension
  await addAuditLogEntry(executionId, "WORKFLOW_SUSPENDED", stepId, {
    reason,
    dataKeys: Object.keys(data),
  });

  // Update execution with suspension state
  return await updatePipelineExecution(executionId, {
    status: "suspended",
    suspension: suspensionData,
  });
}

/**
 * Load suspension state from a pipeline execution.
 * Retrieves the suspension metadata if the execution is currently suspended.
 * 
 * @param executionId - The unique execution identifier
 * @returns The suspension data or null if not suspended
 * @throws Error if database is not available or execution not found
 * 
 * Requirements: 4.1, 8.1
 */
export async function loadSuspensionState(executionId: string): Promise<SuspensionData | null> {
  const execution = await getPipelineExecution(executionId);
  if (!execution) {
    throw new Error(`Execution not found: ${executionId}`);
  }

  if (execution.status !== "suspended" || !execution.suspension) {
    return null;
  }

  try {
    return JSON.parse(execution.suspension) as SuspensionData;
  } catch (error) {
    console.error("[PipelineState] Failed to parse suspension data:", error);
    throw new Error("Invalid suspension data format");
  }
}

/**
 * Clear suspension state and resume a pipeline execution.
 * Updates the execution status back to 'running' and removes suspension metadata.
 * 
 * @param executionId - The unique execution identifier
 * @param resumeData - Data provided when resuming (e.g., approval decision, comments)
 * @returns The updated pipeline execution
 * @throws Error if database is not available, execution not found, or not suspended
 * 
 * Requirements: 4.1, 8.1
 */
export async function clearSuspensionState(
  executionId: string,
  resumeData: Record<string, any> = {}
): Promise<PipelineExecution> {
  const execution = await getPipelineExecution(executionId);
  if (!execution) {
    throw new Error(`Execution not found: ${executionId}`);
  }

  if (execution.status !== "suspended") {
    throw new Error(`Execution is not suspended: ${executionId}`);
  }

  // Get suspension data for audit log
  const suspensionData = execution.suspension ? JSON.parse(execution.suspension) : null;

  // Add audit log entry for resumption
  await addAuditLogEntry(executionId, "WORKFLOW_RESUMED", suspensionData?.stepId || "unknown", {
    resumeData,
    suspendedDuration: suspensionData
      ? Date.now() - new Date(suspensionData.suspendedAt).getTime()
      : 0,
  });

  // Update execution to clear suspension and resume
  return await updatePipelineExecution(executionId, {
    status: "running",
    suspension: null,
  });
}

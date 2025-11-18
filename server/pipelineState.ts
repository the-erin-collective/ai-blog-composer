import { nanoid } from "nanoid";

// In-memory store for pipeline executions
const pipelineStore = new Map<string, any>();

// Event emitter for state changes
type StateChangeHandler = (executionId: string, state: any) => void;
const stateChangeHandlers = new Set<StateChangeHandler>();

export type PipelineStatus = 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'rejected';

export interface SuspensionData {
  suspendedAt: string;
  reason: string;
  stepId: string;
  data: Record<string, any>;
}

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

// Workflow execution context containing intermediate results
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
  resumeData?: Record<string, any>; // Add resumeData field
}

export interface PipelineInput {
  competitorUrl: string;
  editorId: string;
  model?: string; // Add model information
}

export interface PipelineExecution {
  executionId: string;
  competitorUrl: string;
  editorId: string;
  model?: string; // Add model information
  provider?: 'ollama' | 'openrouter'; // Add provider information
  apiKey?: string; // Add API key information (for OpenRouter)
  status: PipelineStatus;
  context: PipelineContext;
  suspension?: SuspensionData;
  metrics: PipelineMetrics;
  createdAt: string;
  updatedAt: string;
}

export const pipelineState = {
  // Store operations
  store: pipelineStore,
  
  /**
   * Create a new pipeline execution in memory.
   */
  async createPipelineExecution(input: { competitorUrl: string; editorId: string; model?: string; provider?: 'ollama' | 'openrouter'; apiKey?: string }): Promise<PipelineExecution> {
    const now = new Date().toISOString();
    const execution: PipelineExecution = {
      executionId: input.competitorUrl, // Using URL as ID for simplicity
      competitorUrl: input.competitorUrl,
      editorId: input.editorId,
      model: input.model, // Store model information
      provider: input.provider, // Store provider information
      apiKey: input.apiKey, // Store API key information (for OpenRouter)
      status: 'pending',
      context: {},
      metrics: {
        startedAt: now,
        auditLog: []
      },
      createdAt: now,
      updatedAt: now
    };
    
    pipelineStore.set(execution.executionId, execution);
    this.notifyStateChange(execution.executionId, execution);
    return execution;
  },
  
  /**
   * Update an existing pipeline execution.
   */
  async updatePipelineExecution(
    executionId: string,
    updates: Partial<Omit<PipelineExecution, 'executionId' | 'createdAt'>>
  ): Promise<PipelineExecution> {
    const execution = pipelineStore.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    const updatedExecution = {
      ...execution,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    pipelineStore.set(executionId, updatedExecution);
    this.notifyStateChange(executionId, updatedExecution);
    return updatedExecution;
  },
  
  /**
   * Get a pipeline execution by ID.
   */
  async getPipelineExecution(executionId: string): Promise<PipelineExecution | undefined> {
    return pipelineStore.get(executionId);
  },
  
  /**
   * Save suspension state for a pipeline execution.
   */
  async saveSuspensionState(
    executionId: string,
    reason: string,
    stepId: string,
    data: Record<string, any>
  ): Promise<PipelineExecution> {
    const suspension: SuspensionData = {
      suspendedAt: new Date().toISOString(),
      reason,
      stepId,
      data
    };
    
    return this.updatePipelineExecution(executionId, {
      status: 'suspended',
      suspension
    });
  },
  
  /**
   * Clear suspension state and resume a pipeline execution.
   */
  async clearSuspensionState(
    executionId: string,
    resumeData: Record<string, any> = {}
  ): Promise<PipelineExecution> {
    const execution = await this.getPipelineExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    if (execution.status !== 'suspended') {
      throw new Error(`Execution ${executionId} is not suspended`);
    }
    
    // Add resume data to context
    const context = {
      ...execution.context,
      resumeData: {
        ...execution.context.resumeData,
        [execution.suspension?.stepId || 'unknown']: {
          resumedAt: new Date().toISOString(),
          ...resumeData
        }
      }
    };
    
    return this.updatePipelineExecution(executionId, {
      status: 'running',
      context,
      suspension: undefined
    });
  },
  
  /**
   * Add an audit log entry to a pipeline execution.
   */
  async addAuditLogEntry(
    executionId: string,
    event: string,
    stepId: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    const execution = await this.getPipelineExecution(executionId);
    if (!execution) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      stepId,
      data
    };
    
    const metrics = {
      ...execution.metrics,
      auditLog: [...(execution.metrics?.auditLog || []), logEntry]
    };
    
    await this.updatePipelineExecution(executionId, { metrics });
  },
  
  // Event handling
  
  /**
   * Subscribe to pipeline state changes
   * @param handler - Function to call when state changes
   * @returns Unsubscribe function
   */
  onStateChange(handler: StateChangeHandler): () => void {
    stateChangeHandlers.add(handler);
    return () => stateChangeHandlers.delete(handler);
  },
  
  /**
   * Notify subscribers of a state change
   */
  notifyStateChange(executionId: string, state: any) {
    stateChangeHandlers.forEach(handler => handler(executionId, state));
  }
};

// Input data for creating a new pipeline execution
export interface PipelineInput {
  competitorUrl: string;
  editorId: string;
  model?: string; // Add model information
  provider?: 'ollama' | 'openrouter'; // Add provider information
  apiKey?: string; // Add API key information (for OpenRouter)
}

// Workflow execution context containing intermediate results
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
  resumeData?: Record<string, any>; // Add resumeData field
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

/**
 * Create a new pipeline execution in memory.
 */
export async function createPipelineExecution(input: PipelineInput): Promise<PipelineExecution> {
  const executionId = nanoid();
  const now = new Date().toISOString();

  const newExecution: PipelineExecution = {
    executionId,
    competitorUrl: input.competitorUrl,
    editorId: input.editorId,
    model: input.model, // Store model information
    provider: input.provider, // Store provider information
    apiKey: input.apiKey, // Store API key information (for OpenRouter)
    status: 'pending',
    context: {},
    metrics: {
      startedAt: now,
      auditLog: [
        {
          timestamp: now,
          event: 'pipeline_created',
          stepId: 'start',
          data: { url: input.competitorUrl }
        }
      ]
    },
    createdAt: now,
    updatedAt: now
  };

  pipelineStore.set(executionId, { ...newExecution });
  console.log(`[In-Memory DB] Created execution ${executionId} for URL: ${input.competitorUrl}`);
  return newExecution;
}

/**
 * Update an existing pipeline execution state in memory.
 */
export async function updatePipelineExecution(
  executionId: string,
  updates: {
    status?: string;
    context?: any;
    suspension?: any;
    metrics?: any;
  }
): Promise<PipelineExecution> {
  const execution = pipelineStore.get(executionId);
  if (!execution) {
    throw new Error(`Pipeline execution ${executionId} not found`);
  }

  const now = new Date().toISOString();
  // Handle metrics merging safely
  const currentMetrics = execution.metrics && typeof execution.metrics === 'string'
    ? JSON.parse(execution.metrics)
    : execution.metrics || {};
    
  const updatedMetrics = updates.metrics || {};

  const updatedExecution = {
    ...execution,
    ...updates,
    updatedAt: now,
    context: {
      ...(execution.context || {}),
      ...(updates.context || {})
    },
    metrics: {
      ...currentMetrics,
      ...(typeof updatedMetrics === 'object' ? updatedMetrics : {})
    }
  };

  pipelineStore.set(executionId, updatedExecution);
  console.log(`[In-Memory DB] Updated execution ${executionId} with`, updates);
  return updatedExecution;
}

/**
 * Retrieve a pipeline execution by its execution ID from memory.
 */
export async function getPipelineExecution(executionId: string): Promise<PipelineExecution | undefined> {
  const execution = pipelineStore.get(executionId);
  if (!execution) {
    console.log(`[In-Memory DB] Execution ${executionId} not found`);
    return undefined;
  }
  return { ...execution };
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

  // Handle both string and object metrics
  const existingMetrics = execution.metrics && typeof execution.metrics === 'string' 
    ? JSON.parse(execution.metrics) 
    : execution.metrics || {};
  const auditLog = existingMetrics.auditLog || [];

  auditLog.push({
    timestamp: new Date().toISOString(),
    event,
    stepId,
    data,
  });

  // Ensure we don't stringify the metrics object if it's already a string
  const updatedMetrics = {
    ...existingMetrics,
    auditLog,
  };

  await updatePipelineExecution(executionId, {
    metrics: updatedMetrics,
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
    // Handle both string and object formats for suspension data
    if (typeof execution.suspension === 'string') {
      return JSON.parse(execution.suspension) as SuspensionData;
    } else {
      return execution.suspension as SuspensionData;
    }
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

  // Get suspension data for audit log, handling both string and object formats
  let suspensionData = null;
  if (execution.suspension) {
    if (typeof execution.suspension === 'string') {
      suspensionData = JSON.parse(execution.suspension);
    } else {
      suspensionData = execution.suspension;
    }
  }

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

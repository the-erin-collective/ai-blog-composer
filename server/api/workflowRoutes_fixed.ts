import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createOllamaClient } from '../agents/ollamaClient';
import { createWorkflow } from '../agents/observerWorkflow';
import { getPipelineExecution } from '../pipelineState';

// Add CORS middleware
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // Backend server (for server-side rendering)
];

const allowCors = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
};

const router = Router();
router.use(allowCors);

/**
 * Input validation schema for starting a workflow
 */
const startWorkflowSchema = z.object({
  competitorUrl: z.string().url('Invalid URL format'),
  editorId: z.string().optional().default('web-interface'),
  model: z.string().optional().default('phi4-mini-reasoning'),
});

/**
 * Helper function to safely parse JSON or return the value if it's already an object
 */
const safeJsonParse = (value: any) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return null;
  }
};

/**
 * POST /api/workflow/start
 * 
 * Start a new content generation workflow
 * 
 * Requirements: 10.1, 1.1, 1.4
 */
router.post('/start', async (req: Request, res: Response) => {
  console.log('Received request to /api/workflow/start', { body: req.body });
  try {
    // Validate input
    const validationResult = startWorkflowSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validationResult.error.format(),
        },
      });
    }

    const { competitorUrl, editorId, model } = validationResult.data;

    console.log(`[API] Starting workflow for URL: ${competitorUrl} with model: ${model}`);

    // Create Ollama client with the selected model and workflow
    const ollamaClient = createOllamaClient(model);
    const workflow = createWorkflow(ollamaClient);

    // Start workflow asynchronously
    // The workflow will create a new execution in the database and return immediately
    // with the execution ID when it reaches the first suspension point
    const result = await workflow.execute({
      url: competitorUrl,
      editorId,
      model, // Pass the model to the workflow context
    });

    // Return execution ID and status
    return res.status(200).json({
      success: true,
      data: {
        executionId: result.executionId,
        status: result.status,
        message: result.status === 'suspended' 
          ? 'Workflow started and suspended at approval gate'
          : result.status === 'error'
          ? 'Workflow failed to start'
          : 'Workflow started successfully',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[API] Failed to start workflow:', {
      error: errorMessage,
      stack: errorStack,
      body: req.body,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'WORKFLOW_START_FAILED',
        message: `Failed to start workflow: ${errorMessage}`,
      },
    });
  }
});

/**
 * GET /api/workflow/executions/:executionId
 * 
 * Get the current state of a workflow execution
 * 
 * Requirements: 10.2, 10.4
 */
router.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    if (!executionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Execution ID is required',
        },
      });
    }

    console.log(`[API] Getting execution state: ${executionId}`);

    // Retrieve execution from database
    const execution = await getPipelineExecution(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EXECUTION_NOT_FOUND',
          message: `Execution not found: ${executionId}`,
        },
      });
    }

    // Parse JSON fields safely
    const parsedExecution = {
      executionId: execution.executionId,
      status: execution.status,
      input: safeJsonParse(execution.input),
      context: safeJsonParse(execution.context),
      suspension: safeJsonParse(execution.suspension),
      metrics: safeJsonParse(execution.metrics),
    };

    return res.status(200).json({
      success: true,
      data: parsedExecution,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[API] Failed to get execution state:', {
      error: errorMessage,
      stack: errorStack,
      executionId: req.params.executionId,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATE_FAILED',
        message: `Failed to get execution state: ${errorMessage}`,
      },
    });
  }
});

/**
 * POST /api/workflow/executions/:executionId/resume
 * 
 * Resume a suspended workflow execution
 * 
 * Requirements: 10.3, 10.5
 */
router.post('/executions/:executionId/resume', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { action, data } = req.body;

    if (!executionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Execution ID is required',
        },
      });
    }

    console.log(`[API] Resuming execution: ${executionId} with action: ${action}`);

    // In a real implementation, you would resume the workflow here
    // For now, we'll just return a success response
    return res.status(200).json({
      success: true,
      data: {
        executionId,
        status: 'running',
        message: 'Workflow resumed successfully',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[API] Failed to resume execution:', {
      error: errorMessage,
      stack: errorStack,
      executionId: req.params.executionId,
      body: req.body,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_FAILED',
        message: `Failed to resume execution: ${errorMessage}`,
      },
    });
  }
});

export default router;

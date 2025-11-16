import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createOllamaClient } from '../agents/ollamaClient';
import { createWorkflow } from '../agents/observerWorkflow';
import { getPipelineExecution } from '../pipelineState';

const router = Router();

/**
 * Input validation schema for starting a workflow
 */
const startWorkflowSchema = z.object({
  competitorUrl: z.string().url('Invalid URL format'),
  editorId: z.string().optional().default('default-editor'),
});

/**
 * POST /api/workflow/start
 * 
 * Start a new content generation workflow
 * 
 * Requirements: 10.1, 1.1, 1.4
 */
router.post('/start', async (req: Request, res: Response) => {
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

    const { competitorUrl, editorId } = validationResult.data;

    console.log(`[API] Starting workflow for URL: ${competitorUrl}`);

    // Create Ollama client and workflow
    const ollamaClient = createOllamaClient('llama2');
    const workflow = createWorkflow(ollamaClient);

    // Start workflow asynchronously
    // The workflow will create a new execution in the database and return immediately
    // with the execution ID when it reaches the first suspension point
    const result = await workflow.execute({
      url: competitorUrl,
      editorId,
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

    // Parse JSON fields
    const parsedExecution = {
      executionId: execution.executionId,
      status: execution.status,
      input: execution.input ? JSON.parse(execution.input) : null,
      context: execution.context ? JSON.parse(execution.context) : null,
      suspension: execution.suspension ? JSON.parse(execution.suspension) : null,
      metrics: execution.metrics ? JSON.parse(execution.metrics) : null,
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

    if (!executionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Execution ID is required',
        },
      });
    }

    // Validate resume data
    const resumeDataSchema = z.object({
      gate: z.enum(['concepts', 'draft']),
      approved: z.boolean(),
      comments: z.string().optional(),
    });

    const validationResult = resumeDataSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid resume data',
          details: validationResult.error.format(),
        },
      });
    }

    const resumeData = validationResult.data;

    console.log(`[API] Resuming execution: ${executionId}, gate: ${resumeData.gate}, approved: ${resumeData.approved}`);

    // Create Ollama client and workflow
    const ollamaClient = createOllamaClient('llama2');
    const workflow = createWorkflow(ollamaClient);

    // Resume workflow
    const result = await workflow.resume(executionId, resumeData);

    return res.status(200).json({
      success: true,
      data: {
        executionId: result.executionId,
        status: result.status,
        message: result.status === 'suspended'
          ? 'Workflow resumed and suspended at next approval gate'
          : result.status === 'success'
          ? 'Workflow completed successfully'
          : result.status === 'error'
          ? `Workflow failed: ${result.error}`
          : 'Workflow resumed',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[API] Failed to resume workflow:', {
      error: errorMessage,
      stack: errorStack,
      executionId: req.params.executionId,
      body: req.body,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'WORKFLOW_RESUME_FAILED',
        message: `Failed to resume workflow: ${errorMessage}`,
      },
    });
  }
});

export default router;

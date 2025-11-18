import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createOllamaClient } from '../agents/ollamaClient';
import { createOpenRouterClient } from '../agents/openRouterClient';
import { createWorkflow } from '../agents/observerWorkflow';
import { getPipelineExecution, clearSuspensionState } from '../pipelineState';

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
 * GET /api/workflow/models
 * 
 * Get available local Ollama models (for local Ollama deployments)
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    // Create Ollama client with default configuration
    const ollamaClient = createOllamaClient('gemma3:270m'); // Use any model to create client
    
    // Check if Ollama is healthy
    const isHealthy = await ollamaClient.checkHealth();
    
    if (!isHealthy) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'OLLAMA_UNAVAILABLE',
          message: 'Local Ollama service is not available',
        },
      });
    }
    
    // Get available models using axios directly since client is private
    const axios = (ollamaClient as any).client; // Access private client for this specific case
    const response = await axios.get('/api/tags');
    const models = response.data.models || [];
    
    return res.status(200).json({
      success: true,
      data: {
        models: models.map((m: any) => m.name),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[API] Failed to get local Ollama models:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'MODELS_FETCH_FAILED',
        message: `Failed to fetch models: ${errorMessage}`,
      },
    });
  }
});

/**
 * POST /api/workflow/openrouter-models
 * 
 * Get available OpenRouter models
 */
router.post('/openrouter-models', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'API key is required',
        },
      });
    }
    
    // Fetch models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Extract model names from the response
    const models = data.data?.map((model: any) => model.id) || [];
    
    return res.status(200).json({
      success: true,
      data: {
        models,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[API] Failed to get OpenRouter models:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'OPENROUTER_MODELS_FETCH_FAILED',
        message: `Failed to fetch OpenRouter models: ${errorMessage}`,
      },
    });
  }
});

/**
 * Input validation schema for starting a workflow
 */
const startWorkflowSchema = z.object({
  inspirationUrl: z.string().url('Invalid URL format'),
  editorId: z.string().optional().default('web-interface'),
  model: z.string().optional().default('phi4-mini-reasoning'),
  provider: z.enum(['ollama', 'openrouter']).optional().default('ollama'),
  apiKey: z.string().optional(),
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

    const { inspirationUrl, editorId, model, provider, apiKey } = validationResult.data;

    console.log(`[API] Starting workflow for URL: ${inspirationUrl} with model: ${model} and provider: ${provider}`);

    // Create appropriate client based on provider
    let ollamaClient;
    if (provider === 'openrouter' && apiKey) {
      // For OpenRouter, we'll create a custom client
      ollamaClient = createOpenRouterClient(apiKey, model);
    } else {
      // Default to Ollama client
      ollamaClient = createOllamaClient(model);
    }
    
    const workflow = createWorkflow(ollamaClient);

    // Start workflow asynchronously
    // The workflow will create a new execution in the database and return immediately
    // with the execution ID when it reaches the first suspension point
    const result = await workflow.execute({
      url: inspirationUrl,
      editorId,
      model,
      provider,
      apiKey,
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
      input: {
        inspirationUrl: execution.inspirationUrl,
        editorId: execution.editorId,
      },
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
    const { action, gate, comments } = req.body;

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

    // Validate that we have the required fields
    if (!action || !gate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Action and gate are required',
        },
      });
    }

    // Get the execution to retrieve the model information
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

    // Create appropriate client based on the provider used for the initial execution
    const model = execution.model || 'phi4-mini-reasoning'; // Use stored model or default
    const provider = (execution as any).provider || 'ollama'; // Use stored provider or default
    let ollamaClient;
    
    if (provider === 'openrouter' && (execution as any).apiKey) {
      // For OpenRouter, we'll create a custom client
      ollamaClient = createOpenRouterClient((execution as any).apiKey, model);
    } else {
      // Default to Ollama client
      ollamaClient = createOllamaClient(model);
    }
    
    const workflow = createWorkflow(ollamaClient);

    // Prepare resume data in the format expected by the workflow
    const resumeData = {
      gate: gate as 'concepts' | 'draft',
      approved: action === 'approve',
      comments,
    };

    // Resume the workflow execution
    const result = await workflow.resume(executionId, resumeData);

    return res.status(200).json({
      success: true,
      data: {
        executionId,
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

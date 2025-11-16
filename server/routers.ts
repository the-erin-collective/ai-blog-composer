import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createOllamaClient } from "./agents/ollamaClient";
import { createWorkflow } from "./agents/observerWorkflow";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  workflow: router({
    execute: publicProcedure
      .input(z.object({
        url: z.string().url('Invalid URL provided'),
        editorId: z.string().optional().default('default-editor')
      }))
      .mutation(async ({ input }) => {
        try {
          const ollamaClient = createOllamaClient('llama2');
          const workflow = createWorkflow(ollamaClient);
          const result = await workflow.execute({ 
            url: input.url,
            editorId: input.editorId 
          });
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Workflow execution failed: ${errorMessage}`);
        }
      }),
    getExecutionState: publicProcedure
      .input(z.object({
        executionId: z.string()
      }))
      .query(async ({ input }) => {
        try {
          const { getPipelineExecution } = await import('./pipelineState');
          const execution = await getPipelineExecution(input.executionId);
          
          if (!execution) {
            throw new Error(`Execution not found: ${input.executionId}`);
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

          return parsedExecution;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to get execution state: ${errorMessage}`);
        }
      }),
    resume: publicProcedure
      .input(z.object({
        executionId: z.string(),
        resumeData: z.object({
          gate: z.enum(['concepts', 'draft']),
          approved: z.boolean(),
          comments: z.string().optional()
        })
      }))
      .mutation(async ({ input }) => {
        try {
          const ollamaClient = createOllamaClient('llama2');
          const workflow = createWorkflow(ollamaClient);
          const result = await workflow.resume(input.executionId, input.resumeData);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Workflow resume failed: ${errorMessage}`);
        }
      }),
    health: publicProcedure
      .query(async () => {
        try {
          const ollamaClient = createOllamaClient('llama2');
          const isHealthy = await ollamaClient.checkHealth();
          return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            message: isHealthy ? 'Ollama is running and model is available' : 'Ollama is not responding or model is not loaded'
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            status: 'error',
            message: `Health check failed: ${errorMessage}`
          };
        }
      })
  })
});

export type AppRouter = typeof appRouter;

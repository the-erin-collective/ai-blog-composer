import { extractMetadata, ExtractedMetadata } from './metadataExtractor';
import { OllamaClient } from './ollamaClient';
import { MetadataSummarizer, ConceptExtractionResult } from './metadataSummarizer';
import { OutlineGenerator, OutlineOutput } from './outlineGenerator';
import { DraftGenerator, DraftOutput } from './draftGenerator';
import { HtmlFormatter } from './htmlFormatter';
import {
  createPipelineExecution,
  updatePipelineExecution,
  addAuditLogEntry,
  saveSuspensionState,
  loadSuspensionState,
  clearSuspensionState,
  getPipelineExecution,
  PipelineInput,
  PipelineContext,
} from '../pipelineState';

export interface WorkflowInput {
  url: string;
  editorId?: string;
}

export interface WorkflowOutput {
  executionId: string;
  url: string;
  metadata: ExtractedMetadata;
  concepts: ConceptExtractionResult;
  outline?: OutlineOutput;
  draft?: DraftOutput;
  html?: string;
  status: 'success' | 'error' | 'suspended';
  error?: string;
  executedAt: string;
}

export interface ResumeData {
  gate: 'concepts' | 'draft';
  approved: boolean;
  comments?: string;
}

/**
 * Observer Agent Workflow
 * Orchestrates the linear pipeline:
 * Start → Metadata Extractor → Metadata Summarizer → End
 *
 * This is the main workflow that validates Ollama integration
 */
export class ObserverWorkflow {
  private ollamaClient: OllamaClient;
  private summarizer: MetadataSummarizer;
  private outlineGenerator: OutlineGenerator;
  private draftGenerator: DraftGenerator;
  private htmlFormatter: HtmlFormatter;

  constructor(ollamaClient: OllamaClient) {
    this.ollamaClient = ollamaClient;
    this.summarizer = new MetadataSummarizer(ollamaClient);
    this.outlineGenerator = new OutlineGenerator(ollamaClient);
    this.draftGenerator = new DraftGenerator(ollamaClient);
    this.htmlFormatter = new HtmlFormatter();
  }

  /**
   * Execute the complete workflow with database persistence
   * 
   * Requirements: 1.1, 1.3, 1.5
   */
  async execute(input: WorkflowInput): Promise<WorkflowOutput> {
    const startTime = new Date();
    let executionId: string | undefined;

    try {
      // Create pipeline execution in database
      const pipelineInput: PipelineInput = {
        competitorUrl: input.url,
        editorId: input.editorId || 'default-editor',
      };

      console.log(`[Workflow] Creating pipeline execution for URL: ${input.url}`);
      
      try {
        const execution = await createPipelineExecution(pipelineInput);
        executionId = execution.executionId;
        console.log(`[Workflow] Created execution: ${executionId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Workflow] Failed to create pipeline execution:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          url: input.url,
        });
        throw new Error(`Failed to initialize pipeline: ${errorMessage}`);
      }

      // Step 1: Metadata Extraction (Deterministic)
      console.log(`[Workflow] Step 1: Starting metadata extraction`);
      let metadata: ExtractedMetadata;
      
      try {
        await addAuditLogEntry(executionId, 'STEP_STARTED', 'metadata-extraction', {
          url: input.url,
        });

        metadata = await extractMetadata(input.url);
        console.log(`[Workflow] Extracted metadata: ${metadata.title}, ${metadata.headings.length} headings`);

        // Save metadata to context
        // Note: The current metadata extractor returns headings as a flat array of strings
        // For now, we'll store them all as h2 headings in the context
        const metadataContext: PipelineContext = {
          metadata: {
            title: metadata.title,
            metaDescription: metadata.metaDescription,
            headings: {
              h1: [],
              h2: metadata.headings,
              h3: [],
            },
            extractedAt: new Date().toISOString(),
          },
        };

        await updatePipelineExecution(executionId, {
          context: metadataContext,
        });

        await addAuditLogEntry(executionId, 'STEP_COMPLETED', 'metadata-extraction', {
          title: metadata.title,
          headingCount: metadata.headings.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Workflow] Metadata extraction failed:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          url: input.url,
          executionId,
        });

        await addAuditLogEntry(executionId, 'STEP_FAILED', 'metadata-extraction', {
          error: errorMessage,
          url: input.url,
        });

        throw new Error(`Metadata extraction failed: ${errorMessage}`);
      }

      // Step 2: Metadata Summarization (LLM-Powered via Ollama)
      console.log(`[Workflow] Step 2: Starting concept extraction`);
      let concepts: ConceptExtractionResult;
      
      try {
        await addAuditLogEntry(executionId, 'STEP_STARTED', 'concept-extraction', {});

        // Try to extract concepts if Ollama is available, otherwise use a fallback
        try {
          const isOllamaAvailable = await this.checkOllamaHealth();
          if (isOllamaAvailable) {
            concepts = await this.summarizer.extractConcepts(metadata);
            console.log(`[Workflow] Extracted ${concepts.concepts.length} concepts using Ollama`);
          } else {
            throw new Error('Ollama not available, using fallback concepts');
          }
        } catch (error) {
          // Fallback to simple keyword extraction if Ollama is not available
          console.log(`[Workflow] Using fallback concept extraction`);
          concepts = this.extractFallbackConcepts(metadata);
        }

        // Save concepts to context
        await updatePipelineExecution(executionId, {
          context: {
            concepts: concepts.concepts,
          },
        });

        await addAuditLogEntry(executionId, 'STEP_COMPLETED', 'concept-extraction', {
          conceptCount: concepts.concepts.length,
          usedFallback: !(await this.ollamaClient.checkHealth())
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Workflow] Concept extraction failed:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          executionId,
          metadataTitle: metadata.title,
        });

        await addAuditLogEntry(executionId, 'STEP_FAILED', 'concept-extraction', {
          error: errorMessage,
        });

        // Instead of failing, continue with empty concepts
        concepts = { concepts: [], summary: 'No concepts extracted' };
      }

      // Concept Approval Gate - Suspend workflow for human review
      console.log(`[Workflow] Concept Approval Gate: Suspending for human review`);
      
      try {
        // Ensure concepts is an array of strings
        const conceptList = Array.isArray(concepts.concepts) ? concepts.concepts : [];
        
        await saveSuspensionState(
          executionId,
          'Waiting for concept approval',
          'concepts', // This should match what the frontend expects for stepId
          {
            gate: 'concepts',
            concepts: conceptList,
            // Add additional metadata that might be useful for the frontend
            metadata: {
              title: metadata.title || 'Untitled',
              url: input.url,
              extractedAt: new Date().toISOString(),
            }
          }
        );

        console.log(`[Workflow] Workflow suspended at concept approval gate: ${executionId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Workflow] Failed to save suspension state:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          executionId,
        });

        await addAuditLogEntry(executionId, 'STEP_FAILED', 'gate-concept-approval', {
          error: errorMessage,
        });

        throw new Error(`Failed to suspend workflow: ${errorMessage}`);
      }
      
      // Return suspended status - workflow will be resumed via resume() method
      return {
        executionId,
        url: input.url,
        metadata,
        concepts,
        status: 'suspended',
        executedAt: startTime.toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`[Workflow] Workflow execution failed:`, {
        error: errorMessage,
        stack: errorStack,
        url: input.url,
        executionId,
        duration: Date.now() - startTime.getTime(),
      });

      // Update execution status to failed if we have an executionId
      if (executionId) {
        try {
          await updatePipelineExecution(executionId, {
            status: 'failed',
          });

          await addAuditLogEntry(executionId, 'WORKFLOW_FAILED', 'workflow', {
            error: errorMessage,
            stack: errorStack,
            totalDuration: Date.now() - startTime.getTime(),
          });
        } catch (updateError) {
          const updateErrorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
          console.error(`[Workflow] Failed to update execution status:`, {
            error: updateErrorMessage,
            stack: updateError instanceof Error ? updateError.stack : undefined,
            executionId,
          });
        }
      }

      return {
        executionId: executionId || 'unknown',
        url: input.url,
        metadata: { title: '', metaDescription: '', headings: [] },
        concepts: { concepts: [], summary: '' },
        status: 'error',
        error: errorMessage,
        executedAt: startTime.toISOString(),
      };
    }
  }

  /**
   * Resume workflow execution from a suspension point
   * 
   * @param executionId - The execution ID to resume
   * @param resumeData - Data containing approval decision and comments
   * @returns The workflow output after resuming
   * 
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 1.5
   */
  async resume(executionId: string, resumeData: ResumeData): Promise<WorkflowOutput> {
    const startTime = new Date();

    try {
      console.log(`[Workflow] Resuming execution: ${executionId}`);

      // Load suspension state
      let suspensionState;
      let execution;
      let context: any;
      let input: any;

      try {
        suspensionState = await loadSuspensionState(executionId);
        if (!suspensionState) {
          throw new Error(`Execution ${executionId} is not suspended`);
        }

        // Get the execution to retrieve context
        execution = await getPipelineExecution(executionId);
        if (!execution) {
          throw new Error(`Execution not found: ${executionId}`);
        }

        context = execution.context ? JSON.parse(execution.context) : {};
        input = execution.input ? JSON.parse(execution.input) : {};
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Workflow] Failed to load execution state:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          executionId,
        });
        throw new Error(`Failed to load execution state: ${errorMessage}`);
      }

      // Handle concept approval gate
      if (suspensionState.stepId === 'gate-concept-approval' && resumeData.gate === 'concepts') {
        console.log(`[Workflow] Processing concept approval: ${resumeData.approved ? 'APPROVED' : 'REJECTED'}`);

        try {
          // Clear suspension state and resume
          await clearSuspensionState(executionId, resumeData);

          // Add audit log for approval decision
          await addAuditLogEntry(executionId, 'CONCEPT_APPROVAL_DECISION', 'gate-concept-approval', {
            approved: resumeData.approved,
            comments: resumeData.comments,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Workflow] Failed to process concept approval:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            executionId,
          });
          throw new Error(`Failed to process concept approval: ${errorMessage}`);
        }

        // If rejected, terminate the workflow
        if (!resumeData.approved) {
          console.log(`[Workflow] Concepts rejected - terminating workflow`);
          
          try {
            await updatePipelineExecution(executionId, {
              status: 'rejected',
            });

            await addAuditLogEntry(executionId, 'WORKFLOW_REJECTED', 'workflow', {
              reason: 'Concepts rejected by editor',
              comments: resumeData.comments,
              totalDuration: Date.now() - startTime.getTime(),
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Workflow] Failed to update rejection status:`, {
              error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
              executionId,
            });
          }

          return {
            executionId,
            url: input.competitorUrl,
            metadata: context.metadata || { title: '', metaDescription: '', headings: [] },
            concepts: { concepts: context.concepts || [], summary: '' },
            status: 'error',
            error: 'Workflow rejected at concept approval gate',
            executedAt: startTime.toISOString(),
          };
        }

        // If approved, continue with outline generation
        console.log(`[Workflow] Concepts approved - continuing to outline generation`);

        // Step 3: Outline Generation
        console.log(`[Workflow] Step 3: Starting outline generation`);
        let outline: OutlineOutput;
        
        try {
          await addAuditLogEntry(executionId, 'STEP_STARTED', 'outline-generation', {});

          outline = await this.outlineGenerator.generateOutline({
            concepts: context.concepts || [],
          });
          console.log(`[Workflow] Generated outline with ${outline.sections.length} sections`);

          // Save outline to context
          await updatePipelineExecution(executionId, {
            context: {
              outline,
            },
          });

          await addAuditLogEntry(executionId, 'STEP_COMPLETED', 'outline-generation', {
            sectionCount: outline.sections.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Workflow] Outline generation failed:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            executionId,
            conceptCount: context.concepts?.length || 0,
          });

          await addAuditLogEntry(executionId, 'STEP_FAILED', 'outline-generation', {
            error: errorMessage,
          });

          throw new Error(`Outline generation failed: ${errorMessage}`);
        }

        // Step 4: Draft Generation
        console.log(`[Workflow] Step 4: Starting draft generation`);
        let draft: DraftOutput;
        
        try {
          await addAuditLogEntry(executionId, 'STEP_STARTED', 'draft-generation', {});

          draft = await this.draftGenerator.generateDraft({
            outline,
          });
          console.log(`[Workflow] Generated draft with ${draft.wordCount} words`);

          // Save draft to context
          await updatePipelineExecution(executionId, {
            context: {
              draft,
            },
          });

          await addAuditLogEntry(executionId, 'STEP_COMPLETED', 'draft-generation', {
            wordCount: draft.wordCount,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Workflow] Draft generation failed:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            executionId,
            outlineSections: outline.sections.length,
          });

          await addAuditLogEntry(executionId, 'STEP_FAILED', 'draft-generation', {
            error: errorMessage,
          });

          throw new Error(`Draft generation failed: ${errorMessage}`);
        }

        // Draft Approval Gate - Suspend workflow for human review
        console.log(`[Workflow] Draft Approval Gate: Suspending for human review`);
        
        try {
          await saveSuspensionState(
            executionId,
            'Waiting for draft approval',
            'gate-draft-approval',
            {
              gate: 'draft',
              draft,
              qualityScore: context.reviewScore,
              distinctivenessScore: context.distinctivenessScore,
            }
          );

          console.log(`[Workflow] Workflow suspended at draft approval gate: ${executionId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Workflow] Failed to save draft suspension state:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            executionId,
          });

          await addAuditLogEntry(executionId, 'STEP_FAILED', 'gate-draft-approval', {
            error: errorMessage,
          });

          throw new Error(`Failed to suspend workflow at draft gate: ${errorMessage}`);
        }
        
        // Return suspended status - workflow will be resumed via resume() method
        return {
          executionId,
          url: input.competitorUrl,
          metadata: context.metadata || { title: '', metaDescription: '', headings: [] },
          concepts: { concepts: context.concepts || [], summary: '' },
          outline,
          draft,
          status: 'suspended',
          executedAt: startTime.toISOString(),
        };
      }

      // Handle draft approval gate
      if (suspensionState.stepId === 'gate-draft-approval' && resumeData.gate === 'draft') {
        console.log(`[Workflow] Processing draft approval: ${resumeData.approved ? 'APPROVED' : 'REJECTED'}`);

        try {
          // Clear suspension state and resume
          await clearSuspensionState(executionId, resumeData);

          // Add audit log for approval decision
          await addAuditLogEntry(executionId, 'DRAFT_APPROVAL_DECISION', 'gate-draft-approval', {
            approved: resumeData.approved,
            comments: resumeData.comments,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Workflow] Failed to process draft approval:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            executionId,
          });
          throw new Error(`Failed to process draft approval: ${errorMessage}`);
        }

        // If rejected, terminate the workflow
        if (!resumeData.approved) {
          console.log(`[Workflow] Draft rejected - terminating workflow`);
          
          try {
            await updatePipelineExecution(executionId, {
              status: 'rejected',
            });

            await addAuditLogEntry(executionId, 'WORKFLOW_REJECTED', 'workflow', {
              reason: 'Draft rejected by editor',
              comments: resumeData.comments,
              totalDuration: Date.now() - startTime.getTime(),
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Workflow] Failed to update rejection status:`, {
              error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
              executionId,
            });
          }

          return {
            executionId,
            url: input.competitorUrl,
            metadata: context.metadata || { title: '', metaDescription: '', headings: [] },
            concepts: { concepts: context.concepts || [], summary: '' },
            outline: context.outline,
            draft: context.draft,
            status: 'error',
            error: 'Workflow rejected at draft approval gate',
            executedAt: startTime.toISOString(),
          };
        }

        // If approved, continue with HTML formatting
        console.log(`[Workflow] Draft approved - continuing to HTML formatting`);

        // Step 5: HTML Formatting
        console.log(`[Workflow] Step 5: Starting HTML formatting`);
        let htmlOutput;
        
        try {
          await addAuditLogEntry(executionId, 'STEP_STARTED', 'html-formatting', {});

          htmlOutput = this.htmlFormatter.formatToHtml({
            draft: context.draft,
          });
          console.log(`[Workflow] Generated HTML output`);

          // Save HTML to context
          await updatePipelineExecution(executionId, {
            context: {
              html: htmlOutput.html,
            },
          });

          await addAuditLogEntry(executionId, 'STEP_COMPLETED', 'html-formatting', {
            htmlLength: htmlOutput.html.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Workflow] HTML formatting failed:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            executionId,
            draftWordCount: context.draft?.wordCount || 0,
          });

          await addAuditLogEntry(executionId, 'STEP_FAILED', 'html-formatting', {
            error: errorMessage,
          });

          throw new Error(`HTML formatting failed: ${errorMessage}`);
        }

        // Mark workflow as completed
        try {
          await updatePipelineExecution(executionId, {
            status: 'completed',
          });

          await addAuditLogEntry(executionId, 'WORKFLOW_COMPLETED', 'workflow', {
            totalDuration: Date.now() - startTime.getTime(),
          });

          console.log(`[Workflow] Workflow completed successfully: ${executionId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Workflow] Failed to mark workflow as completed:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            executionId,
          });
          // Don't throw here - we still want to return the successful result
        }

        // Return results
        return {
          executionId,
          url: input.competitorUrl,
          metadata: context.metadata || { title: '', metaDescription: '', headings: [] },
          concepts: { concepts: context.concepts || [], summary: '' },
          outline: context.outline,
          draft: context.draft,
          html: htmlOutput.html,
          status: 'success',
          executedAt: startTime.toISOString(),
        };
      }

      // If we reach here, the gate type doesn't match
      throw new Error(`Invalid resume data: gate type mismatch or unsupported gate`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`[Workflow] Resume workflow failed:`, {
        error: errorMessage,
        stack: errorStack,
        executionId,
        gate: resumeData.gate,
        duration: Date.now() - startTime.getTime(),
      });

      // Update execution status to failed
      try {
        await updatePipelineExecution(executionId, {
          status: 'failed',
        });

        await addAuditLogEntry(executionId, 'WORKFLOW_FAILED', 'workflow', {
          error: errorMessage,
          stack: errorStack,
          totalDuration: Date.now() - startTime.getTime(),
        });
      } catch (updateError) {
        const updateErrorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
        console.error(`[Workflow] Failed to update execution status:`, {
          error: updateErrorMessage,
          stack: updateError instanceof Error ? updateError.stack : undefined,
          executionId,
        });
      }

      return {
        executionId,
        url: '',
        metadata: { title: '', metaDescription: '', headings: [] },
        concepts: { concepts: [], summary: '' },
        status: 'error',
        error: errorMessage,
        executedAt: startTime.toISOString(),
      };
    }
  }

  /**
   * Fallback concept extraction when Ollama is not available
   */
  private extractFallbackConcepts(metadata: any): ConceptExtractionResult {
    // Simple keyword extraction from title and description
    const text = `${metadata.title} ${metadata.metaDescription || ''}`.toLowerCase();
    const words = text
      .split(/\s+/)
      .filter(word => word.length > 3) // Filter out short words
      .filter(word => !/^https?:\/\//.test(word)) // Filter out URLs
      .filter(word => !/^[^a-z]/.test(word)); // Filter out words starting with non-letters

    // Count word frequencies
    const wordCounts = words.reduce((counts: Record<string, number>, word: string) => {
      counts[word] = (counts[word] || 0) + 1;
      return counts;
    }, {});

    // Get top 5 most common words as concepts
    const concepts = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

    return {
      concepts,
      summary: `Extracted ${concepts.length} key concepts from content`
    };
  }
}

export function createWorkflow(ollamaClient: OllamaClient): ObserverWorkflow {
  return new ObserverWorkflow(ollamaClient);
}

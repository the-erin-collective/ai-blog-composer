# Workflow Database Persistence Implementation

## Task 7.1: Update workflow to use database persistence

This document describes the implementation of task 7.1 from the content-engine-demo spec.

### Requirements

- **Requirement 1.1**: Pipeline initialization and execution
- **Requirement 1.3**: Pipeline state persistence

### Implementation Summary

The workflow has been updated to integrate database persistence at every step of the pipeline execution. The implementation ensures that:

1. ✅ **Execution state is saved after each step**
2. ✅ **Status is updated as workflow progresses**
3. ✅ **Intermediate results are stored** (metadata, concepts, outline, draft, HTML)

### Changes Made

#### 1. Updated `observerWorkflow.ts`

**File**: `src/server/agents/observerWorkflow.ts`

**Key Changes**:

- **Imports**: Added imports for database persistence functions:
  ```typescript
  import {
    createPipelineExecution,
    updatePipelineExecution,
    addAuditLogEntry,
    PipelineInput,
    PipelineContext,
  } from '../pipelineState';
  ```

- **Workflow Input**: Extended to include `editorId`:
  ```typescript
  export interface WorkflowInput {
    url: string;
    editorId?: string;
  }
  ```

- **Workflow Output**: Extended to include `executionId` and all intermediate results:
  ```typescript
  export interface WorkflowOutput {
    executionId: string;
    url: string;
    metadata: ExtractedMetadata;
    concepts: ConceptExtractionResult;
    outline?: OutlineOutput;
    draft?: DraftOutput;
    html?: string;
    status: 'success' | 'error';
    error?: string;
    executedAt: string;
  }
  ```

- **Agent Initialization**: Added instances for all agents:
  ```typescript
  private outlineGenerator: OutlineGenerator;
  private draftGenerator: DraftGenerator;
  private htmlFormatter: HtmlFormatter;
  ```

- **Execute Method**: Completely refactored to include database persistence:

  **Step 0: Create Pipeline Execution**
  ```typescript
  const execution = await createPipelineExecution(pipelineInput);
  executionId = execution.executionId;
  ```

  **Step 1: Metadata Extraction**
  - Logs audit entry: `STEP_STARTED` for `metadata-extraction`
  - Extracts metadata using `extractMetadata()`
  - Saves metadata to context using `updatePipelineExecution()`
  - Logs audit entry: `STEP_COMPLETED` for `metadata-extraction`

  **Step 2: Concept Extraction**
  - Logs audit entry: `STEP_STARTED` for `concept-extraction`
  - Extracts concepts using `summarizer.extractConcepts()`
  - Saves concepts to context using `updatePipelineExecution()`
  - Logs audit entry: `STEP_COMPLETED` for `concept-extraction`

  **Step 3: Outline Generation**
  - Logs audit entry: `STEP_STARTED` for `outline-generation`
  - Generates outline using `outlineGenerator.generateOutline()`
  - Saves outline to context using `updatePipelineExecution()`
  - Logs audit entry: `STEP_COMPLETED` for `outline-generation`

  **Step 4: Draft Generation**
  - Logs audit entry: `STEP_STARTED` for `draft-generation`
  - Generates draft using `draftGenerator.generateDraft()`
  - Saves draft to context using `updatePipelineExecution()`
  - Logs audit entry: `STEP_COMPLETED` for `draft-generation`

  **Step 5: HTML Formatting**
  - Logs audit entry: `STEP_STARTED` for `html-formatting`
  - Formats HTML using `htmlFormatter.formatToHtml()`
  - Saves HTML to context using `updatePipelineExecution()`
  - Logs audit entry: `STEP_COMPLETED` for `html-formatting`

  **Step 6: Mark as Completed**
  - Updates status to `completed` using `updatePipelineExecution()`
  - Logs audit entry: `WORKFLOW_COMPLETED` for `workflow`

  **Error Handling**:
  - If any step fails, the execution status is updated to `failed`
  - Audit log entry `WORKFLOW_FAILED` is added with error details
  - Error is logged and returned in the output

#### 2. Updated `routers.ts`

**File**: `src/server/routers.ts`

**Key Changes**:

- **Input Schema**: Extended to accept `editorId`:
  ```typescript
  .input(z.object({
    url: z.string().url('Invalid URL provided'),
    editorId: z.string().optional().default('default-editor')
  }))
  ```

- **Workflow Execution**: Passes `editorId` to workflow:
  ```typescript
  const result = await workflow.execute({ 
    url: input.url,
    editorId: input.editorId 
  });
  ```

### Database Schema

The implementation uses the existing `pipelineExecutions` table defined in `src/drizzle/schema.ts`:

```typescript
export const pipelineExecutions = mysqlTable(
  "pipelineExecutions",
  {
    id: int("id").autoincrement().primaryKey(),
    executionId: varchar("executionId", { length: 64 }).notNull().unique(),
    status: mysqlEnum("status", ["running", "suspended", "completed", "rejected", "failed"])
      .notNull()
      .default("running"),
    input: text("input").notNull(),
    context: text("context"),
    suspension: text("suspension"),
    metrics: text("metrics"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }
);
```

### Persistence Functions Used

The implementation leverages the following functions from `pipelineState.ts`:

1. **`createPipelineExecution(input: PipelineInput)`**
   - Creates a new pipeline execution in the database
   - Generates a unique `executionId`
   - Initializes status as `running`
   - Creates initial audit log entry

2. **`updatePipelineExecution(executionId, updates)`**
   - Updates execution state with new context data
   - Merges context with existing data (preserves previous steps)
   - Updates status when workflow completes or fails
   - Merges audit log entries

3. **`addAuditLogEntry(executionId, event, stepId, data)`**
   - Adds audit log entries for each step
   - Tracks workflow progress and events
   - Stores metadata about each step execution

### Context Structure

The workflow stores the following intermediate results in the `context` field:

```typescript
interface PipelineContext {
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
  html?: string;
}
```

### Audit Log Events

The workflow generates the following audit log events:

1. `PIPELINE_INITIALIZED` - When execution is created
2. `STEP_STARTED` - Before each step begins
3. `STEP_COMPLETED` - After each step completes successfully
4. `WORKFLOW_COMPLETED` - When entire workflow finishes
5. `WORKFLOW_FAILED` - If workflow encounters an error

### Verification

To verify the implementation:

1. **Code Review**: All TypeScript files compile without errors
2. **Type Safety**: All interfaces and types are properly defined
3. **Error Handling**: Proper try-catch blocks and error logging
4. **Database Integration**: Uses existing persistence functions correctly

### Testing

Two test scripts have been created:

1. **`verify-workflow-persistence.mjs`**
   - Tests database persistence functions directly
   - Verifies context updates after each step
   - Checks audit log entries
   - Requires database connection

2. **`test-workflow-persistence.mjs`**
   - Tests complete workflow execution
   - Verifies end-to-end persistence
   - Requires Ollama and database connection

### Requirements Verification

✅ **Requirement 1.1**: Pipeline initialization and execution
- Pipeline is initialized with `createPipelineExecution()`
- Execution ID is generated and tracked
- Workflow executes through all steps

✅ **Requirement 1.3**: Pipeline state persistence
- Execution state is saved after each step
- Status is updated as workflow progresses (running → completed/failed)
- Intermediate results are stored in context:
  - Metadata after extraction
  - Concepts after summarization
  - Outline after generation
  - Draft after generation
  - HTML after formatting
- Audit log tracks all state transitions

### Next Steps

This implementation completes task 7.1. The next tasks in the workflow orchestration phase are:

- **Task 7.2**: Implement concept approval gate
- **Task 7.3**: Implement draft approval gate
- **Task 7.4**: Add workflow error handling

These tasks will build upon the database persistence foundation established in this implementation.

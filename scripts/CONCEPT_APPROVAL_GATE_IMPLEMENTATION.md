# Concept Approval Gate Implementation

## Overview
Implemented the concept approval gate functionality that suspends the workflow after concept extraction and allows human review before proceeding to outline generation.

## Requirements Satisfied
- **4.1**: Workflow suspends execution at concept approval gate
- **4.2**: Suspension state exposes extracted concepts and execution ID through API
- **4.3**: Workflow waits indefinitely for editor approval without timing out
- **4.4**: Workflow resumes from suspension point when editor approves
- **4.5**: Workflow terminates with rejected status when editor rejects

## Implementation Details

### 1. Workflow Modifications (`src/server/agents/observerWorkflow.ts`)

#### Added Interfaces
- `ResumeData`: Interface for resume data containing gate type, approval decision, and optional comments
- Updated `WorkflowOutput` to include 'suspended' status

#### Modified `execute()` Method
- After concept extraction completes, workflow now:
  1. Calls `saveSuspensionState()` with concepts data
  2. Returns with status 'suspended'
  3. Includes execution ID for tracking

#### New `resume()` Method
- Loads suspension state from database
- Validates suspension state and gate type
- Handles approval decision:
  - **If approved**: Clears suspension, continues to outline generation → draft generation → HTML formatting → completion
  - **If rejected**: Updates status to 'rejected', logs rejection reason, terminates workflow
- Includes full error handling and audit logging

### 2. API Endpoints (`src/server/routers.ts`)

#### New `getExecutionState` Endpoint
- **Route**: `workflow.getExecutionState`
- **Method**: Query
- **Input**: `{ executionId: string }`
- **Output**: Complete execution state including suspension data
- **Purpose**: Allows frontend to poll execution state and display concepts for review

#### New `resume` Endpoint
- **Route**: `workflow.resume`
- **Method**: Mutation
- **Input**: `{ executionId: string, resumeData: { gate, approved, comments } }`
- **Output**: Workflow output after resuming
- **Purpose**: Allows editor to approve or reject concepts and resume workflow

### 3. Database Integration

Uses existing pipeline state functions:
- `saveSuspensionState()`: Saves suspension metadata with concepts
- `loadSuspensionState()`: Retrieves suspension data for resume
- `clearSuspensionState()`: Clears suspension and updates status to running
- `getPipelineExecution()`: Retrieves full execution context

## Workflow Flow

### Initial Execution
```
Start → Metadata Extraction → Concept Extraction → [SUSPEND] → Return { status: 'suspended' }
```

### Resume with Approval
```
Resume → Load State → Clear Suspension → Outline Generation → Draft Generation → HTML Formatting → Complete
```

### Resume with Rejection
```
Resume → Load State → Update Status to 'rejected' → Log Rejection → Return Error
```

## Testing

### Verification Script
Created `src/scripts/verify-concept-approval-gate.mjs` that validates:
- ✓ ResumeData interface and suspended status
- ✓ Suspension state imports and usage
- ✓ Suspension point in execute() method
- ✓ resume() method implementation
- ✓ Approval and rejection handling
- ✓ API endpoints for getExecutionState and resume
- ✓ Input validation with Zod schemas

All 28 verification checks passed successfully.

### Integration Test
Created `src/scripts/test-concept-approval-gate.mjs` for end-to-end testing (requires database):
- Tests workflow suspension at concept gate
- Tests execution state retrieval
- Tests rejection flow
- Tests approval flow with complete pipeline execution

## API Usage Examples

### Start Workflow
```typescript
const result = await trpc.workflow.execute.mutate({
  url: 'https://example.com',
  editorId: 'editor-123'
});
// Returns: { executionId, status: 'suspended', concepts: [...] }
```

### Get Execution State
```typescript
const state = await trpc.workflow.getExecutionState.query({
  executionId: 'abc123'
});
// Returns: { executionId, status, context, suspension: { data: { concepts } } }
```

### Resume with Approval
```typescript
const result = await trpc.workflow.resume.mutate({
  executionId: 'abc123',
  resumeData: {
    gate: 'concepts',
    approved: true,
    comments: 'Concepts look great!'
  }
});
// Continues workflow to completion
```

### Resume with Rejection
```typescript
const result = await trpc.workflow.resume.mutate({
  executionId: 'abc123',
  resumeData: {
    gate: 'concepts',
    approved: false,
    comments: 'Not aligned with our strategy'
  }
});
// Returns: { status: 'error', error: 'Workflow rejected...' }
```

## Next Steps

The concept approval gate is now fully implemented. The next task (7.3) will implement the draft approval gate using the same pattern.

## Files Modified
- `src/server/agents/observerWorkflow.ts` - Added resume() method and suspension logic
- `src/server/routers.ts` - Added getExecutionState and resume endpoints

## Files Created
- `src/scripts/verify-concept-approval-gate.mjs` - Verification script
- `src/scripts/test-concept-approval-gate.mjs` - Integration test script
- `src/scripts/CONCEPT_APPROVAL_GATE_IMPLEMENTATION.md` - This document

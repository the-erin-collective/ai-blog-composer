# Draft Approval Gate Implementation

## Overview

This document describes the implementation of the draft approval gate in the Observer Workflow. The draft approval gate is the second human-in-the-loop checkpoint that allows editors to review and approve or reject the generated article draft before it proceeds to HTML formatting.

## Requirements Satisfied

- **8.1**: Workflow suspends at draft approval gate after passing automated quality checks
- **8.2**: Suspension state exposes draft content, quality score, and distinctiveness score
- **8.3**: Workflow waits indefinitely for editor approval without timing out
- **8.4**: Workflow resumes to finalization on approval
- **8.5**: Workflow routes back to draft generator on rejection (or terminates in MVP)

## Implementation Details

### 1. Suspension Point After Draft Generation

After the draft is generated and saved to the pipeline context, the workflow suspends execution:

```typescript
// Draft Approval Gate - Suspend workflow for human review
console.log(`[Workflow] Draft Approval Gate: Suspending for human review`);
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
```

**Key Features:**
- Suspends after draft generation is complete
- Saves draft data in suspension state
- Includes quality and distinctiveness scores (if available)
- Updates execution status to 'suspended'
- Returns suspended status to caller

### 2. Suspension State Data

The suspension state includes:

```typescript
{
  suspendedAt: string;           // ISO timestamp
  reason: 'Waiting for draft approval';
  stepId: 'gate-draft-approval';
  data: {
    gate: 'draft';
    draft: {
      title: string;
      metaDescription: string;
      bodyParagraphs: string[];
      wordCount: number;
    };
    qualityScore?: number;        // 0-100 (if reviewer agent implemented)
    distinctivenessScore?: number; // 0-1 (if similarity monitor implemented)
  }
}
```

### 3. Resume Function - Draft Approval Handler

The `resume()` method handles draft approval decisions:

```typescript
// Handle draft approval gate
if (suspensionState.stepId === 'gate-draft-approval' && resumeData.gate === 'draft') {
  console.log(`[Workflow] Processing draft approval: ${resumeData.approved ? 'APPROVED' : 'REJECTED'}`);

  // Clear suspension state and resume
  await clearSuspensionState(executionId, resumeData);

  // Add audit log for approval decision
  await addAuditLogEntry(executionId, 'DRAFT_APPROVAL_DECISION', 'gate-draft-approval', {
    approved: resumeData.approved,
    comments: resumeData.comments,
  });

  // Handle rejection or approval...
}
```

**Resume Data Format:**
```typescript
{
  gate: 'draft';
  approved: boolean;
  comments?: string;
}
```

### 4. Rejection Path

When the editor rejects the draft:

```typescript
if (!resumeData.approved) {
  console.log(`[Workflow] Draft rejected - terminating workflow`);
  await updatePipelineExecution(executionId, {
    status: 'rejected',
  });

  await addAuditLogEntry(executionId, 'WORKFLOW_REJECTED', 'workflow', {
    reason: 'Draft rejected by editor',
    comments: resumeData.comments,
    totalDuration: Date.now() - startTime.getTime(),
  });

  return {
    executionId,
    url: input.inspirationUrl,
    metadata: context.metadata || { title: '', metaDescription: '', headings: [] },
    concepts: { concepts: context.concepts || [], summary: '' },
    outline: context.outline,
    draft: context.draft,
    status: 'error',
    error: 'Workflow rejected at draft approval gate',
    executedAt: startTime.toISOString(),
  };
}
```

**Rejection Behavior:**
- Updates execution status to 'rejected'
- Logs rejection reason and editor comments
- Returns error status with rejection message
- Workflow terminates (does not route back to draft generator in MVP)

### 5. Approval Path

When the editor approves the draft:

```typescript
// If approved, continue with HTML formatting
console.log(`[Workflow] Draft approved - continuing to HTML formatting`);

// Step 5: HTML Formatting
console.log(`[Workflow] Step 5: Starting HTML formatting`);
await addAuditLogEntry(executionId, 'STEP_STARTED', 'html-formatting', {});

const htmlOutput = this.htmlFormatter.formatToHtml({
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

// Mark workflow as completed
await updatePipelineExecution(executionId, {
  status: 'completed',
});
```

**Approval Behavior:**
- Continues to HTML formatting step
- Uses draft from context (not from suspension data)
- Generates HTML output
- Saves HTML to context
- Updates execution status to 'completed'
- Returns success status with HTML output

### 6. API Integration

The draft approval gate integrates with existing API endpoints:

**Get Execution State:**
```typescript
GET /api/workflow/getExecutionState?executionId={id}

Response when suspended at draft gate:
{
  executionId: string;
  status: 'suspended';
  suspension: {
    suspendedAt: string;
    reason: 'Waiting for draft approval';
    stepId: 'gate-draft-approval';
    data: {
      gate: 'draft';
      draft: { ... };
      qualityScore?: number;
      distinctivenessScore?: number;
    }
  };
  context: { ... };
}
```

**Resume Workflow:**
```typescript
POST /api/workflow/resume
Body: {
  executionId: string;
  resumeData: {
    gate: 'draft';
    approved: boolean;
    comments?: string;
  }
}

Response:
{
  executionId: string;
  status: 'success' | 'error';
  html?: string;  // Present if approved
  error?: string; // Present if rejected
}
```

## Workflow Flow

```
Draft Generation Complete
         ↓
   Suspend at Draft Gate
         ↓
   Save Suspension State
         ↓
   Return 'suspended' Status
         ↓
   [Wait for Editor Review]
         ↓
   Editor Decision
         ↓
    ┌────┴────┐
    ↓         ↓
Approve    Reject
    ↓         ↓
HTML       Terminate
Formatter  (status: rejected)
    ↓
Complete
(status: completed)
```

## Testing

### Verification Script

Run the verification script to check implementation:

```bash
node scripts/verify-draft-approval-gate.mjs
```

This script verifies:
- ✓ Suspension point after draft generation
- ✓ Suspension state contains draft data
- ✓ Suspension includes quality and distinctiveness scores
- ✓ Resume function checks for draft approval
- ✓ Routes to HTML formatter on approval
- ✓ Terminates workflow on rejection
- ✓ Audit log records approval decisions

### Manual Testing

To test the draft approval gate manually:

1. Start a workflow:
```bash
curl -X POST http://localhost:3000/api/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "editorId": "test-editor"}'
```

2. Approve concepts to reach draft gate:
```bash
curl -X POST http://localhost:3000/api/workflow/resume \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "<execution-id>",
    "resumeData": {
      "gate": "concepts",
      "approved": true,
      "comments": "Concepts look good"
    }
  }'
```

3. Check execution state (should be suspended at draft gate):
```bash
curl http://localhost:3000/api/workflow/getExecutionState?executionId=<execution-id>
```

4. Approve or reject draft:
```bash
# Approve
curl -X POST http://localhost:3000/api/workflow/resume \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "<execution-id>",
    "resumeData": {
      "gate": "draft",
      "approved": true,
      "comments": "Draft looks great"
    }
  }'

# Or Reject
curl -X POST http://localhost:3000/api/workflow/resume \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "<execution-id>",
    "resumeData": {
      "gate": "draft",
      "approved": false,
      "comments": "Needs improvement"
    }
  }'
```

## Audit Trail

The implementation creates the following audit log entries:

1. **STEP_COMPLETED** (draft-generation): When draft is generated
2. **WORKFLOW_SUSPENDED** (gate-draft-approval): When workflow suspends
3. **WORKFLOW_RESUMED** (gate-draft-approval): When editor resumes workflow
4. **DRAFT_APPROVAL_DECISION** (gate-draft-approval): Records approval/rejection
5. **WORKFLOW_REJECTED** (workflow): If draft is rejected
6. **STEP_STARTED** (html-formatting): If draft is approved
7. **STEP_COMPLETED** (html-formatting): When HTML is generated
8. **WORKFLOW_COMPLETED** (workflow): When workflow finishes successfully

## Future Enhancements

The current implementation terminates the workflow on rejection. Future enhancements could include:

1. **Iterative Refinement**: Route back to draft generator with editor comments
2. **Revision Tracking**: Track number of revision cycles
3. **Revision Limits**: Limit maximum number of revisions (e.g., 3 cycles)
4. **Partial Edits**: Allow editor to make inline edits instead of full rejection
5. **Multiple Reviewers**: Support multiple editor approvals
6. **Approval Timeouts**: Add optional timeout for approval decisions

## Related Files

- `src/server/agents/observerWorkflow.ts` - Main workflow implementation
- `src/server/pipelineState.ts` - State management functions
- `src/server/routers.ts` - API endpoints
- `src/scripts/verify-draft-approval-gate.mjs` - Verification script
- `src/scripts/test-draft-approval-gate.mjs` - Integration test (requires database)

## Conclusion

The draft approval gate implementation provides a robust human-in-the-loop checkpoint that allows editors to review and control the final draft before HTML generation. The implementation follows the same pattern as the concept approval gate, ensuring consistency and maintainability.

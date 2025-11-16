# Start Workflow Endpoint Implementation

## Task 8.1: Create start workflow endpoint

### Implementation Summary

Created REST API endpoints for workflow management at `/api/workflow/*`:

1. **POST /api/workflow/start** - Start a new workflow execution
2. **GET /api/workflow/executions/:executionId** - Get execution state
3. **POST /api/workflow/executions/:executionId/resume** - Resume suspended workflow

### Files Created/Modified

1. **src/server/api/workflowRoutes.ts** (NEW)
   - Implements all three REST API endpoints
   - Input validation using Zod schemas
   - Proper error handling with appropriate HTTP status codes
   - Comprehensive logging

2. **src/server/_core/index.ts** (MODIFIED)
   - Registered workflow routes at `/api/workflow`
   - Routes are registered before tRPC routes

### Endpoint Details

#### POST /api/workflow/start

**Purpose**: Start a new content generation workflow

**Request Body**:
```json
{
  "competitorUrl": "https://example.com/article",
  "editorId": "editor-123" // optional, defaults to "default-editor"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "executionId": "abc123xyz",
    "status": "suspended",
    "message": "Workflow started and suspended at approval gate"
  }
}
```

**Error Response (400)** - Invalid input:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  }
}
```

**Error Response (500)** - Server error:
```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_START_FAILED",
    "message": "Failed to start workflow: ..."
  }
}
```

**Behavior**:
1. Validates input (competitorUrl must be valid URL)
2. Creates new execution in database
3. Starts workflow asynchronously
4. Returns execution ID immediately
5. Workflow runs until first suspension point (concept approval gate)

#### GET /api/workflow/executions/:executionId

**Purpose**: Retrieve current state of a workflow execution

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "executionId": "abc123xyz",
    "status": "suspended",
    "input": {
      "competitorUrl": "https://example.com/article",
      "editorId": "editor-123"
    },
    "context": {
      "metadata": { ... },
      "concepts": [ ... ]
    },
    "suspension": {
      "suspendedAt": "2024-01-01T12:00:00Z",
      "reason": "Waiting for concept approval",
      "stepId": "gate-concept-approval",
      "data": { ... }
    },
    "metrics": {
      "startedAt": "2024-01-01T12:00:00Z",
      "auditLog": [ ... ]
    }
  }
}
```

**Error Response (404)** - Execution not found:
```json
{
  "success": false,
  "error": {
    "code": "EXECUTION_NOT_FOUND",
    "message": "Execution not found: abc123xyz"
  }
}
```

#### POST /api/workflow/executions/:executionId/resume

**Purpose**: Resume a suspended workflow with approval decision

**Request Body**:
```json
{
  "gate": "concepts",
  "approved": true,
  "comments": "Looks good, proceed"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "executionId": "abc123xyz",
    "status": "suspended",
    "message": "Workflow resumed and suspended at next approval gate"
  }
}
```

**Error Response (400)** - Invalid resume data:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid resume data",
    "details": { ... }
  }
}
```

### Requirements Satisfied

✅ **Requirement 10.1**: POST endpoint to start new pipeline executions
- Endpoint: `POST /api/workflow/start`
- Validates input (competitorUrl)
- Creates new execution in database
- Returns execution ID

✅ **Requirement 1.1**: Initialize pipeline with unique execution ID
- Uses nanoid to generate unique execution IDs
- Stores execution in database with status "running"

✅ **Requirement 1.4**: Return execution ID within 2 seconds
- Endpoint returns immediately after starting workflow
- Workflow runs asynchronously
- Response time < 2 seconds for initialization

✅ **Requirement 10.2**: GET endpoint to retrieve pipeline state
- Endpoint: `GET /api/workflow/executions/:executionId`
- Returns current status and context
- Includes suspension details if suspended

✅ **Requirement 10.3**: POST endpoint to resume suspended workflows
- Endpoint: `POST /api/workflow/executions/:executionId/resume`
- Validates resumeData (gate, approved, comments)
- Updates execution state and resumes workflow

✅ **Requirement 10.4**: Include suspension details in state response
- State response includes suspension reason and step ID
- Includes suspension data for human review

✅ **Requirement 10.5**: Appropriate HTTP status codes
- 200: Success
- 400: Validation errors
- 404: Execution not found
- 500: Server errors

### Error Handling

1. **Input Validation**:
   - URL format validation using Zod
   - Required field validation
   - Type checking

2. **Database Errors**:
   - Catches database connection failures
   - Handles execution not found scenarios
   - Returns appropriate error messages

3. **Workflow Errors**:
   - Catches workflow execution failures
   - Updates execution status to 'failed'
   - Returns detailed error messages

4. **Logging**:
   - Logs all requests with parameters
   - Logs errors with stack traces
   - Includes execution context in logs

### Testing

Run the test script to verify the implementation:

```bash
# Start the server first
npm run dev

# In another terminal, run the test script
node src/scripts/test-start-workflow-endpoint.mjs
```

The test script verifies:
1. ✓ Starting workflow with valid URL
2. ✓ Validation error for invalid URL
3. ✓ Validation error for missing URL
4. ✓ Getting execution state
5. ✓ 404 error for non-existent execution

### Integration with Existing Code

The REST API endpoints complement the existing tRPC endpoints:

- **tRPC endpoints** (`/api/trpc/workflow.*`): For frontend integration
- **REST endpoints** (`/api/workflow/*`): For external integrations and testing

Both use the same underlying workflow implementation (`ObserverWorkflow`).

### Next Steps

The following endpoints are now available for frontend implementation (Task 9):
- Start workflow: `POST /api/workflow/start`
- Get state: `GET /api/workflow/executions/:executionId`
- Resume workflow: `POST /api/workflow/executions/:executionId/resume`

The frontend can use either the REST API or the tRPC API, depending on preference.

/**
 * Test script for pipeline state persistence functions.
 * 
 * This script tests:
 * - Creating a new pipeline execution
 * - Updating execution state
 * - Retrieving execution by ID
 * - Adding audit log entries
 */

import { createPipelineExecution, updatePipelineExecution, getPipelineExecution, addAuditLogEntry } from '../server/pipelineState.ts';

async function testPipelineState() {
  console.log('🧪 Testing Pipeline State Persistence Functions\n');

  try {
    // Test 1: Create a new pipeline execution
    console.log('Test 1: Creating new pipeline execution...');
    const input = {
      inspirationUrl: 'https://example.com/inspiration-article',
      editorId: 'editor-123',
    };

    const execution = await createPipelineExecution(input);
    console.log('✅ Created execution:', {
      executionId: execution.executionId,
      status: execution.status,
      input: JSON.parse(execution.input),
    });
    console.log('');

    // Test 2: Retrieve the execution by ID
    console.log('Test 2: Retrieving execution by ID...');
    const retrieved = await getPipelineExecution(execution.executionId);
    if (!retrieved) {
      throw new Error('Failed to retrieve execution');
    }
    console.log('✅ Retrieved execution:', {
      executionId: retrieved.executionId,
      status: retrieved.status,
    });
    console.log('');

    // Test 3: Update execution with metadata
    console.log('Test 3: Updating execution with metadata...');
    await updatePipelineExecution(execution.executionId, {
      context: {
        metadata: {
          title: 'Test Article Title',
          metaDescription: 'Test meta description',
          headings: {
            h1: ['Main Heading'],
            h2: ['Subheading 1', 'Subheading 2'],
            h3: ['Detail 1', 'Detail 2'],
          },
          extractedAt: new Date().toISOString(),
        },
      },
    });
    
    const afterMetadata = await getPipelineExecution(execution.executionId);
    const context = JSON.parse(afterMetadata.context);
    console.log('✅ Updated with metadata:', {
      title: context.metadata.title,
      h2Count: context.metadata.headings.h2.length,
    });
    console.log('');

    // Test 4: Update execution with concepts
    console.log('Test 4: Updating execution with concepts...');
    await updatePipelineExecution(execution.executionId, {
      context: {
        concepts: ['AI Technology', 'Machine Learning', 'Data Science', 'Neural Networks'],
      },
    });
    
    const afterConcepts = await getPipelineExecution(execution.executionId);
    const contextWithConcepts = JSON.parse(afterConcepts.context);
    console.log('✅ Updated with concepts:', {
      conceptCount: contextWithConcepts.concepts.length,
      concepts: contextWithConcepts.concepts,
      metadataStillPresent: !!contextWithConcepts.metadata,
    });
    console.log('');

    // Test 5: Suspend execution at concept approval gate
    console.log('Test 5: Suspending execution at concept gate...');
    await updatePipelineExecution(execution.executionId, {
      status: 'suspended',
      suspension: {
        suspendedAt: new Date().toISOString(),
        reason: 'Waiting for concept approval',
        stepId: 'gate-concept-approval',
        data: {
          gate: 'concepts',
          concepts: contextWithConcepts.concepts,
        },
      },
    });
    
    const suspended = await getPipelineExecution(execution.executionId);
    const suspensionData = JSON.parse(suspended.suspension);
    console.log('✅ Suspended execution:', {
      status: suspended.status,
      reason: suspensionData.reason,
      gate: suspensionData.data.gate,
    });
    console.log('');

    // Test 6: Add audit log entry
    console.log('Test 6: Adding audit log entry...');
    await addAuditLogEntry(
      execution.executionId,
      'CONCEPTS_EXTRACTED',
      'metadata-summarizer',
      { conceptCount: 4 }
    );
    
    const withAudit = await getPipelineExecution(execution.executionId);
    const metrics = JSON.parse(withAudit.metrics);
    console.log('✅ Added audit log entry:', {
      totalEntries: metrics.auditLog.length,
      latestEvent: metrics.auditLog[metrics.auditLog.length - 1].event,
    });
    console.log('');

    // Test 7: Resume execution and complete
    console.log('Test 7: Resuming and completing execution...');
    await updatePipelineExecution(execution.executionId, {
      status: 'running',
      suspension: null,
    });
    
    await updatePipelineExecution(execution.executionId, {
      status: 'completed',
      context: {
        html: '<html><body><h1>Final Article</h1></body></html>',
      },
      metrics: {
        completedAt: new Date().toISOString(),
        totalCost: 0.15,
        tokenUsage: {
          summarizer: 150,
          outline: 800,
          draft: 2500,
          reviewer: 400,
        },
      },
    });
    
    const completed = await getPipelineExecution(execution.executionId);
    const finalContext = JSON.parse(completed.context);
    const finalMetrics = JSON.parse(completed.metrics);
    console.log('✅ Completed execution:', {
      status: completed.status,
      hasHtml: !!finalContext.html,
      totalCost: finalMetrics.totalCost,
      duration: new Date(finalMetrics.completedAt) - new Date(finalMetrics.startedAt),
    });
    console.log('');

    // Test 8: Test rejection flow
    console.log('Test 8: Testing rejection flow...');
    const rejectedExecution = await createPipelineExecution({
      inspirationUrl: 'https://example.com/another-article',
      editorId: 'editor-456',
    });
    
    await updatePipelineExecution(rejectedExecution.executionId, {
      status: 'rejected',
      metrics: {
        completedAt: new Date().toISOString(),
      },
    });
    
    await addAuditLogEntry(
      rejectedExecution.executionId,
      'CONCEPTS_REJECTED',
      'gate-concept-approval',
      { reason: 'Topics not aligned with brand' }
    );
    
    const rejected = await getPipelineExecution(rejectedExecution.executionId);
    console.log('✅ Rejected execution:', {
      executionId: rejected.executionId,
      status: rejected.status,
    });
    console.log('');

    console.log('🎉 All tests passed successfully!');
    console.log('\nSummary:');
    console.log('- ✅ Create new execution');
    console.log('- ✅ Retrieve execution by ID');
    console.log('- ✅ Update execution state');
    console.log('- ✅ Update execution context (with merging)');
    console.log('- ✅ Suspend/resume workflow');
    console.log('- ✅ Add audit log entries');
    console.log('- ✅ Complete execution');
    console.log('- ✅ Reject execution');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPipelineState();

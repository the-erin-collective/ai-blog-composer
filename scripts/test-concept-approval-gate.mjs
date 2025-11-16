#!/usr/bin/env node

/**
 * Test script for concept approval gate functionality
 * 
 * This script tests:
 * 1. Workflow suspension at concept approval gate
 * 2. Retrieving execution state while suspended
 * 3. Resuming workflow with approval
 * 4. Resuming workflow with rejection
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { createOllamaClient } from '../server/agents/ollamaClient.ts';
import { createWorkflow } from '../server/agents/observerWorkflow.ts';
import {
  getPipelineExecution,
  loadSuspensionState,
} from '../server/pipelineState.ts';

console.log('=== Concept Approval Gate Test ===\n');

// Test URL
const testUrl = 'https://example.com';

async function testConceptApprovalGate() {
  try {
    // Step 1: Start workflow and verify it suspends at concept gate
    console.log('Step 1: Starting workflow...');
    const ollamaClient = createOllamaClient('llama2');
    const workflow = createWorkflow(ollamaClient);
    
    const result = await workflow.execute({
      url: testUrl,
      editorId: 'test-editor',
    });

    console.log(`✓ Workflow started with execution ID: ${result.executionId}`);
    console.log(`✓ Status: ${result.status}`);
    
    if (result.status !== 'suspended') {
      throw new Error(`Expected status 'suspended', got '${result.status}'`);
    }
    
    console.log(`✓ Workflow suspended as expected\n`);

    // Step 2: Retrieve execution state
    console.log('Step 2: Retrieving execution state...');
    const execution = await getPipelineExecution(result.executionId);
    
    if (!execution) {
      throw new Error('Execution not found');
    }
    
    console.log(`✓ Execution status: ${execution.status}`);
    
    const context = execution.context ? JSON.parse(execution.context) : {};
    console.log(`✓ Concepts in context: ${context.concepts?.length || 0}`);
    
    // Step 3: Load suspension state
    console.log('\nStep 3: Loading suspension state...');
    const suspensionState = await loadSuspensionState(result.executionId);
    
    if (!suspensionState) {
      throw new Error('Suspension state not found');
    }
    
    console.log(`✓ Suspension reason: ${suspensionState.reason}`);
    console.log(`✓ Suspension step: ${suspensionState.stepId}`);
    console.log(`✓ Suspension gate: ${suspensionState.data.gate}`);
    console.log(`✓ Concepts to review: ${suspensionState.data.concepts?.length || 0}`);
    
    if (suspensionState.stepId !== 'gate-concept-approval') {
      throw new Error(`Expected stepId 'gate-concept-approval', got '${suspensionState.stepId}'`);
    }
    
    if (suspensionState.data.gate !== 'concepts') {
      throw new Error(`Expected gate 'concepts', got '${suspensionState.data.gate}'`);
    }

    // Step 4: Test rejection flow
    console.log('\nStep 4: Testing rejection flow...');
    const rejectionResult = await workflow.resume(result.executionId, {
      gate: 'concepts',
      approved: false,
      comments: 'Concepts not aligned with our content strategy',
    });
    
    console.log(`✓ Resume completed with status: ${rejectionResult.status}`);
    
    if (rejectionResult.status !== 'error') {
      throw new Error(`Expected status 'error' after rejection, got '${rejectionResult.status}'`);
    }
    
    if (!rejectionResult.error?.includes('rejected')) {
      throw new Error('Expected error message to mention rejection');
    }
    
    console.log(`✓ Workflow correctly terminated after rejection`);
    
    // Verify execution status is 'rejected'
    const rejectedExecution = await getPipelineExecution(result.executionId);
    if (rejectedExecution?.status !== 'rejected') {
      throw new Error(`Expected execution status 'rejected', got '${rejectedExecution?.status}'`);
    }
    console.log(`✓ Execution status set to 'rejected'\n`);

    // Step 5: Test approval flow with a new execution
    console.log('Step 5: Testing approval flow...');
    const result2 = await workflow.execute({
      url: testUrl,
      editorId: 'test-editor',
    });
    
    console.log(`✓ New workflow started: ${result2.executionId}`);
    
    const approvalResult = await workflow.resume(result2.executionId, {
      gate: 'concepts',
      approved: true,
      comments: 'Concepts look great!',
    });
    
    console.log(`✓ Resume completed with status: ${approvalResult.status}`);
    
    if (approvalResult.status === 'error' && approvalResult.error?.includes('rejected')) {
      throw new Error('Workflow should not be rejected when approved');
    }
    
    // Check if workflow continued (should have outline, draft, html)
    if (approvalResult.outline) {
      console.log(`✓ Outline generated with ${approvalResult.outline.sections.length} sections`);
    }
    
    if (approvalResult.draft) {
      console.log(`✓ Draft generated with ${approvalResult.draft.wordCount} words`);
    }
    
    if (approvalResult.html) {
      console.log(`✓ HTML output generated (${approvalResult.html.length} characters)`);
    }
    
    if (approvalResult.status === 'success') {
      console.log(`✓ Workflow completed successfully after approval\n`);
    }

    console.log('=== All Tests Passed ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testConceptApprovalGate();

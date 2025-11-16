#!/usr/bin/env node

/**
 * Test script for Draft Approval Gate implementation
 * 
 * This script tests:
 * 1. Workflow suspends after draft generation
 * 2. Suspension state contains draft data
 * 3. Resume with approval continues to HTML formatting
 * 4. Resume with rejection terminates workflow
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { createOllamaClient } from '../server/agents/ollamaClient.ts';
import { createWorkflow } from '../server/agents/observerWorkflow.ts';
import { getPipelineExecution } from '../server/pipelineState.ts';

const TEST_URL = 'https://example.com';

async function testDraftApprovalGate() {
  console.log('=== Testing Draft Approval Gate ===\n');

  try {
    // Initialize workflow
    const ollamaClient = createOllamaClient('llama2');
    const workflow = createWorkflow(ollamaClient);

    // Test 1: Start workflow and verify it suspends at concept gate first
    console.log('Test 1: Starting workflow...');
    const result1 = await workflow.execute({
      url: TEST_URL,
      editorId: 'test-editor',
    });

    if (result1.status !== 'suspended') {
      console.error('❌ FAILED: Workflow should suspend at concept approval gate');
      return false;
    }
    console.log('✓ Workflow suspended at concept approval gate');
    console.log(`  Execution ID: ${result1.executionId}\n`);

    // Test 2: Approve concepts to continue to draft generation
    console.log('Test 2: Approving concepts...');
    const result2 = await workflow.resume(result1.executionId, {
      gate: 'concepts',
      approved: true,
      comments: 'Concepts look good',
    });

    if (result2.status !== 'suspended') {
      console.error('❌ FAILED: Workflow should suspend at draft approval gate');
      console.error(`  Got status: ${result2.status}`);
      return false;
    }
    console.log('✓ Workflow suspended at draft approval gate');

    // Test 3: Verify suspension state contains draft data
    console.log('\nTest 3: Verifying suspension state...');
    const execution = await getPipelineExecution(result1.executionId);
    
    if (!execution) {
      console.error('❌ FAILED: Execution not found');
      return false;
    }

    if (execution.status !== 'suspended') {
      console.error('❌ FAILED: Execution status should be "suspended"');
      console.error(`  Got: ${execution.status}`);
      return false;
    }
    console.log('✓ Execution status is "suspended"');

    if (!execution.suspension) {
      console.error('❌ FAILED: Suspension data is missing');
      return false;
    }

    const suspensionData = JSON.parse(execution.suspension);
    
    if (suspensionData.stepId !== 'gate-draft-approval') {
      console.error('❌ FAILED: Suspension stepId should be "gate-draft-approval"');
      console.error(`  Got: ${suspensionData.stepId}`);
      return false;
    }
    console.log('✓ Suspension stepId is "gate-draft-approval"');

    if (suspensionData.reason !== 'Waiting for draft approval') {
      console.error('❌ FAILED: Suspension reason should be "Waiting for draft approval"');
      console.error(`  Got: ${suspensionData.reason}`);
      return false;
    }
    console.log('✓ Suspension reason is correct');

    if (!suspensionData.data || !suspensionData.data.draft) {
      console.error('❌ FAILED: Suspension data should contain draft');
      return false;
    }
    console.log('✓ Suspension data contains draft');

    const draft = suspensionData.data.draft;
    if (!draft.title || !draft.bodyParagraphs || !draft.wordCount) {
      console.error('❌ FAILED: Draft is missing required fields');
      return false;
    }
    console.log('✓ Draft has required fields (title, bodyParagraphs, wordCount)');
    console.log(`  Draft title: "${draft.title}"`);
    console.log(`  Word count: ${draft.wordCount}`);

    // Test 4: Test rejection path
    console.log('\nTest 4: Testing draft rejection...');
    const result3 = await workflow.resume(result1.executionId, {
      gate: 'draft',
      approved: false,
      comments: 'Draft needs improvement',
    });

    if (result3.status !== 'error') {
      console.error('❌ FAILED: Rejected workflow should have status "error"');
      console.error(`  Got: ${result3.status}`);
      return false;
    }
    console.log('✓ Rejected workflow has status "error"');

    if (!result3.error || !result3.error.includes('rejected at draft approval gate')) {
      console.error('❌ FAILED: Error message should indicate rejection at draft gate');
      console.error(`  Got: ${result3.error}`);
      return false;
    }
    console.log('✓ Error message indicates rejection at draft approval gate');

    const rejectedExecution = await getPipelineExecution(result1.executionId);
    if (rejectedExecution?.status !== 'rejected') {
      console.error('❌ FAILED: Execution status should be "rejected"');
      console.error(`  Got: ${rejectedExecution?.status}`);
      return false;
    }
    console.log('✓ Execution status updated to "rejected"');

    // Test 5: Test approval path with a new workflow
    console.log('\nTest 5: Testing draft approval...');
    const result4 = await workflow.execute({
      url: TEST_URL,
      editorId: 'test-editor-2',
    });

    // Approve concepts
    const result5 = await workflow.resume(result4.executionId, {
      gate: 'concepts',
      approved: true,
      comments: 'Concepts approved',
    });

    // Approve draft
    const result6 = await workflow.resume(result4.executionId, {
      gate: 'draft',
      approved: true,
      comments: 'Draft approved',
    });

    if (result6.status !== 'success') {
      console.error('❌ FAILED: Approved workflow should have status "success"');
      console.error(`  Got: ${result6.status}`);
      return false;
    }
    console.log('✓ Approved workflow has status "success"');

    if (!result6.html) {
      console.error('❌ FAILED: Approved workflow should have HTML output');
      return false;
    }
    console.log('✓ Workflow generated HTML output');
    console.log(`  HTML length: ${result6.html.length} characters`);

    const completedExecution = await getPipelineExecution(result4.executionId);
    if (completedExecution?.status !== 'completed') {
      console.error('❌ FAILED: Execution status should be "completed"');
      console.error(`  Got: ${completedExecution?.status}`);
      return false;
    }
    console.log('✓ Execution status updated to "completed"');

    // Verify audit log
    console.log('\nTest 6: Verifying audit log...');
    const metrics = completedExecution.metrics ? JSON.parse(completedExecution.metrics) : {};
    const auditLog = metrics.auditLog || [];

    const draftApprovalEvent = auditLog.find(
      entry => entry.event === 'DRAFT_APPROVAL_DECISION'
    );

    if (!draftApprovalEvent) {
      console.error('❌ FAILED: Audit log should contain DRAFT_APPROVAL_DECISION event');
      return false;
    }
    console.log('✓ Audit log contains DRAFT_APPROVAL_DECISION event');

    if (!draftApprovalEvent.data.approved) {
      console.error('❌ FAILED: Approval decision should be true');
      return false;
    }
    console.log('✓ Approval decision recorded correctly');

    console.log('\n=== All Draft Approval Gate Tests Passed! ===');
    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error);
    return false;
  }
}

// Run tests
testDraftApprovalGate()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

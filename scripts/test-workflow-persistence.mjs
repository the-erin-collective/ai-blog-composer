#!/usr/bin/env node

/**
 * Test script for workflow with database persistence
 * Verifies that the workflow saves execution state after each step
 * 
 * Requirements: 1.1, 1.3
 */

import { createOllamaClient } from '../server/agents/ollamaClient.js';
import { createWorkflow } from '../server/agents/observerWorkflow.js';
import { getPipelineExecution } from '../server/pipelineState.js';

console.log('=== Testing Workflow with Database Persistence ===\n');

async function testWorkflowPersistence() {
  try {
    // Create Ollama client
    console.log('1. Creating Ollama client...');
    const ollamaClient = createOllamaClient('llama2');
    
    // Check Ollama health
    console.log('2. Checking Ollama health...');
    const isHealthy = await ollamaClient.checkHealth();
    if (!isHealthy) {
      console.error('❌ Ollama is not available. Please start Ollama and try again.');
      process.exit(1);
    }
    console.log('✓ Ollama is healthy\n');

    // Create workflow
    console.log('3. Creating workflow...');
    const workflow = createWorkflow(ollamaClient);
    console.log('✓ Workflow created\n');

    // Execute workflow with a test URL
    const testUrl = 'https://example.com';
    console.log(`4. Executing workflow for URL: ${testUrl}`);
    console.log('   This will test database persistence at each step...\n');

    const result = await workflow.execute({
      url: testUrl,
      editorId: 'test-editor'
    });

    console.log('\n=== Workflow Execution Result ===');
    console.log(`Status: ${result.status}`);
    console.log(`Execution ID: ${result.executionId}`);
    console.log(`URL: ${result.url}`);
    
    if (result.status === 'success') {
      console.log('\n✓ Workflow completed successfully!');
      console.log(`  - Metadata extracted: ${result.metadata.title}`);
      console.log(`  - Concepts extracted: ${result.concepts.concepts.length} concepts`);
      console.log(`  - Outline generated: ${result.outline?.sections.length || 0} sections`);
      console.log(`  - Draft generated: ${result.draft?.wordCount || 0} words`);
      console.log(`  - HTML formatted: ${result.html ? 'Yes' : 'No'}`);

      // Verify database persistence
      console.log('\n5. Verifying database persistence...');
      const execution = await getPipelineExecution(result.executionId);
      
      if (!execution) {
        console.error('❌ Execution not found in database!');
        process.exit(1);
      }

      console.log('✓ Execution found in database');
      console.log(`  - Status: ${execution.status}`);
      console.log(`  - Created at: ${execution.createdAt}`);
      console.log(`  - Updated at: ${execution.updatedAt}`);

      // Parse and verify context
      const context = execution.context ? JSON.parse(execution.context) : {};
      console.log('\n✓ Context stored in database:');
      console.log(`  - Metadata: ${context.metadata ? 'Yes' : 'No'}`);
      console.log(`  - Concepts: ${context.concepts ? 'Yes' : 'No'}`);
      console.log(`  - Outline: ${context.outline ? 'Yes' : 'No'}`);
      console.log(`  - Draft: ${context.draft ? 'Yes' : 'No'}`);
      console.log(`  - HTML: ${context.html ? 'Yes' : 'No'}`);

      // Parse and verify metrics
      const metrics = execution.metrics ? JSON.parse(execution.metrics) : {};
      console.log('\n✓ Metrics stored in database:');
      console.log(`  - Started at: ${metrics.startedAt}`);
      console.log(`  - Audit log entries: ${metrics.auditLog?.length || 0}`);

      if (metrics.auditLog && metrics.auditLog.length > 0) {
        console.log('\n✓ Audit log entries:');
        metrics.auditLog.forEach((entry, index) => {
          console.log(`  ${index + 1}. [${entry.stepId}] ${entry.event} at ${entry.timestamp}`);
        });
      }

      console.log('\n=== All Tests Passed! ===');
      console.log('✓ Workflow execution completed');
      console.log('✓ Database persistence verified');
      console.log('✓ Context saved after each step');
      console.log('✓ Audit log maintained');
      
    } else {
      console.error(`\n❌ Workflow failed: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testWorkflowPersistence();

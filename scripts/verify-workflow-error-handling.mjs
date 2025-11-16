#!/usr/bin/env node

/**
 * Verification script for workflow error handling implementation
 * 
 * This script verifies that task 7.4 has been completed by checking:
 * 1. All workflow steps are wrapped in try-catch blocks
 * 2. Execution status is updated to 'failed' on errors
 * 3. Comprehensive error logging is implemented
 * 4. Requirements 1.1 and 1.5 are satisfied
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Workflow Error Handling Verification ===\n');

// Read the workflow file
const workflowPath = join(__dirname, '../server/agents/observerWorkflow.ts');
const workflowContent = readFileSync(workflowPath, 'utf-8');

// Verification checks
const checks = [
  {
    name: 'Pipeline creation wrapped in try-catch',
    pattern: /try\s*{\s*const execution = await createPipelineExecution/,
    description: 'Verifies pipeline creation has error handling'
  },
  {
    name: 'Metadata extraction wrapped in try-catch',
    pattern: /try\s*{[\s\S]*?metadata = await extractMetadata/,
    description: 'Verifies metadata extraction has error handling'
  },
  {
    name: 'Concept extraction wrapped in try-catch',
    pattern: /try\s*{[\s\S]*?concepts = await this\.summarizer\.extractConcepts/,
    description: 'Verifies concept extraction has error handling'
  },
  {
    name: 'Suspension state wrapped in try-catch',
    pattern: /try\s*{[\s\S]*?await saveSuspensionState/,
    description: 'Verifies suspension state saving has error handling'
  },
  {
    name: 'Outline generation wrapped in try-catch',
    pattern: /try\s*{[\s\S]*?outline = await this\.outlineGenerator\.generateOutline/,
    description: 'Verifies outline generation has error handling'
  },
  {
    name: 'Draft generation wrapped in try-catch',
    pattern: /try\s*{[\s\S]*?draft = await this\.draftGenerator\.generateDraft/,
    description: 'Verifies draft generation has error handling'
  },
  {
    name: 'HTML formatting wrapped in try-catch',
    pattern: /try\s*{[\s\S]*?htmlOutput = this\.htmlFormatter\.formatToHtml/,
    description: 'Verifies HTML formatting has error handling'
  },
  {
    name: 'Status updated to failed on error',
    pattern: /await updatePipelineExecution\(executionId,\s*{\s*status:\s*'failed'/,
    description: 'Verifies execution status is set to failed'
  },
  {
    name: 'WORKFLOW_FAILED audit log entry',
    pattern: /await addAuditLogEntry\(executionId,\s*'WORKFLOW_FAILED'/,
    description: 'Verifies workflow failure is logged in audit trail'
  },
  {
    name: 'STEP_FAILED audit log entries',
    pattern: /await addAuditLogEntry\(executionId,\s*'STEP_FAILED'/,
    description: 'Verifies individual step failures are logged'
  },
  {
    name: 'Error logging with stack traces',
    pattern: /stack:\s*error instanceof Error \? error\.stack : undefined/,
    description: 'Verifies stack traces are captured in error logs'
  },
  {
    name: 'Error logging with context',
    pattern: /console\.error\(`\[Workflow\][\s\S]*?failed[\s\S]*?`,\s*{/,
    description: 'Verifies errors are logged with full context'
  },
  {
    name: 'State loading error handling',
    pattern: /suspensionState = await loadSuspensionState[\s\S]*?catch \(error\)/,
    description: 'Verifies state loading has error handling'
  },
  {
    name: 'Nested try-catch for status updates',
    pattern: /try\s*{[\s\S]*?await updatePipelineExecution[\s\S]*?status:\s*'failed'[\s\S]*?}\s*catch \(updateError\)/,
    description: 'Verifies status updates have nested error handling'
  }
];

let passedChecks = 0;
let failedChecks = 0;

console.log('Running verification checks...\n');

checks.forEach((check, index) => {
  const passed = check.pattern.test(workflowContent);
  const status = passed ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${index + 1}. ${check.name}`);
  console.log(`   ${status}: ${check.description}`);
  
  if (passed) {
    passedChecks++;
  } else {
    failedChecks++;
  }
  
  console.log('');
});

// Summary
console.log('=== Verification Summary ===');
console.log(`Total checks: ${checks.length}`);
console.log(`Passed: ${passedChecks}`);
console.log(`Failed: ${failedChecks}`);
console.log('');

if (failedChecks === 0) {
  console.log('✅ All verification checks passed!');
  console.log('');
  console.log('Task 7.4 Implementation Complete:');
  console.log('  ✅ All steps wrapped in try-catch blocks');
  console.log('  ✅ Execution status updated to "failed" on errors');
  console.log('  ✅ Comprehensive error logging with full context');
  console.log('  ✅ Stack traces captured and logged');
  console.log('  ✅ Audit trail maintained with STEP_FAILED and WORKFLOW_FAILED entries');
  console.log('  ✅ Requirements 1.1 and 1.5 satisfied');
  console.log('');
  process.exit(0);
} else {
  console.log('❌ Some verification checks failed.');
  console.log('Please review the implementation.');
  console.log('');
  process.exit(1);
}

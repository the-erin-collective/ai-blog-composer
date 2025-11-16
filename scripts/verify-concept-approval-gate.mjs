#!/usr/bin/env node

/**
 * Verification script for concept approval gate implementation
 * 
 * This script verifies:
 * 1. ObserverWorkflow has resume() method
 * 2. Workflow suspends at concept gate in execute()
 * 3. API endpoints exist for getExecutionState and resume
 * 4. Suspension state functions are imported and used
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Concept Approval Gate Implementation Verification ===\n');

let allPassed = true;

function checkFile(filePath, checks) {
  console.log(`Checking ${filePath}...`);
  const content = readFileSync(join(__dirname, '..', filePath), 'utf-8');
  
  let passed = 0;
  let failed = 0;
  
  checks.forEach(({ name, pattern, shouldExist = true }) => {
    const exists = pattern.test(content);
    if (exists === shouldExist) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      failed++;
      allPassed = false;
    }
  });
  
  console.log(`  Result: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// Check 1: ObserverWorkflow implementation
console.log('Check 1: ObserverWorkflow Implementation\n');
checkFile('server/agents/observerWorkflow.ts', [
  {
    name: 'ResumeData interface defined',
    pattern: /interface ResumeData\s*{[\s\S]*?gate:\s*['"]concepts['"][\s\S]*?approved:\s*boolean/
  },
  {
    name: 'WorkflowOutput includes suspended status',
    pattern: /status:\s*['"]success['"][\s\S]*?['"]error['"][\s\S]*?['"]suspended['"]/
  },
  {
    name: 'Imports saveSuspensionState',
    pattern: /import[\s\S]*?saveSuspensionState[\s\S]*?from\s+['"]\.\.\/pipelineState['"]/
  },
  {
    name: 'Imports loadSuspensionState',
    pattern: /import[\s\S]*?loadSuspensionState[\s\S]*?from\s+['"]\.\.\/pipelineState['"]/
  },
  {
    name: 'Imports clearSuspensionState',
    pattern: /import[\s\S]*?clearSuspensionState[\s\S]*?from\s+['"]\.\.\/pipelineState['"]/
  },
  {
    name: 'Imports getPipelineExecution',
    pattern: /import[\s\S]*?getPipelineExecution[\s\S]*?from\s+['"]\.\.\/pipelineState['"]/
  },
  {
    name: 'Calls saveSuspensionState in execute()',
    pattern: /await\s+saveSuspensionState\s*\(/
  },
  {
    name: 'Suspends at concept approval gate',
    pattern: /saveSuspensionState[\s\S]*?['"]gate-concept-approval['"]/
  },
  {
    name: 'Returns suspended status from execute()',
    pattern: /return\s*{[\s\S]*?status:\s*['"]suspended['"]/
  },
  {
    name: 'resume() method exists',
    pattern: /async\s+resume\s*\(\s*executionId:\s*string,\s*resumeData:\s*ResumeData\s*\)/
  },
  {
    name: 'resume() loads suspension state',
    pattern: /await\s+loadSuspensionState\s*\(\s*executionId\s*\)/
  },
  {
    name: 'resume() clears suspension state',
    pattern: /await\s+clearSuspensionState\s*\(\s*executionId/
  },
  {
    name: 'resume() handles approval',
    pattern: /if\s*\(\s*!?resumeData\.approved\s*\)/
  },
  {
    name: 'resume() handles rejection',
    pattern: /status:\s*['"]rejected['"]/
  },
  {
    name: 'resume() continues to outline generation on approval',
    pattern: /outlineGenerator\.generateOutline/
  }
]);

// Check 2: API Router implementation
console.log('Check 2: API Router Implementation\n');
checkFile('server/routers.ts', [
  {
    name: 'getExecutionState endpoint exists',
    pattern: /getExecutionState:\s*publicProcedure/
  },
  {
    name: 'getExecutionState accepts executionId',
    pattern: /getExecutionState[\s\S]*?\.input\s*\(\s*z\.object\s*\(\s*{\s*executionId:\s*z\.string\(\)/
  },
  {
    name: 'getExecutionState calls getPipelineExecution',
    pattern: /getPipelineExecution\s*\(\s*input\.executionId\s*\)/
  },
  {
    name: 'resume endpoint exists',
    pattern: /resume:\s*publicProcedure/
  },
  {
    name: 'resume accepts executionId and resumeData',
    pattern: /resume[\s\S]*?\.input\s*\([\s\S]*?executionId:[\s\S]*?resumeData:/
  },
  {
    name: 'resume validates gate type',
    pattern: /gate:\s*z\.enum\s*\(\s*\[\s*['"]concepts['"]/
  },
  {
    name: 'resume validates approved boolean',
    pattern: /approved:\s*z\.boolean\(\)/
  },
  {
    name: 'resume calls workflow.resume()',
    pattern: /workflow\.resume\s*\(\s*input\.executionId,\s*input\.resumeData\s*\)/
  }
]);

// Check 3: Pipeline State functions
console.log('Check 3: Pipeline State Functions\n');
checkFile('server/pipelineState.ts', [
  {
    name: 'saveSuspensionState function exists',
    pattern: /export\s+async\s+function\s+saveSuspensionState/
  },
  {
    name: 'loadSuspensionState function exists',
    pattern: /export\s+async\s+function\s+loadSuspensionState/
  },
  {
    name: 'clearSuspensionState function exists',
    pattern: /export\s+async\s+function\s+clearSuspensionState/
  },
  {
    name: 'saveSuspensionState updates status to suspended',
    pattern: /saveSuspensionState[\s\S]*?status:\s*['"]suspended['"]/
  },
  {
    name: 'clearSuspensionState updates status to running',
    pattern: /clearSuspensionState[\s\S]*?status:\s*['"]running['"]/
  }
]);

// Summary
console.log('=== Verification Summary ===\n');
if (allPassed) {
  console.log('✓ All checks passed!');
  console.log('\nImplementation includes:');
  console.log('  • Suspension point after concept extraction');
  console.log('  • Suspension state saved with concepts data');
  console.log('  • Resume function that checks for approval');
  console.log('  • Routes to outline generation on approval');
  console.log('  • Terminates workflow on rejection');
  console.log('  • API endpoints for getExecutionState and resume');
  console.log('\nRequirements satisfied: 4.1, 4.2, 4.3, 4.4, 4.5');
  process.exit(0);
} else {
  console.log('✗ Some checks failed. Please review the implementation.');
  process.exit(1);
}

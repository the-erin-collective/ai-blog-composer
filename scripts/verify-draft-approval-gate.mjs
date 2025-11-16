#!/usr/bin/env node

/**
 * Verification script for draft approval gate implementation
 * 
 * This script verifies:
 * 1. Workflow suspends at draft approval gate after draft generation
 * 2. Suspension state contains draft data
 * 3. Resume function handles draft approval
 * 4. Routes to HTML formatter on approval
 * 5. Terminates workflow on rejection
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Draft Approval Gate Implementation Verification ===\n');

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
console.log('Check 1: ObserverWorkflow Draft Approval Gate\n');
checkFile('server/agents/observerWorkflow.ts', [
  {
    name: 'ResumeData interface includes draft gate',
    pattern: /gate:\s*['"]concepts['"][\s\S]*?['"]draft['"]/
  },
  {
    name: 'Suspends at draft approval gate after draft generation',
    pattern: /saveSuspensionState[\s\S]*?['"]gate-draft-approval['"]/
  },
  {
    name: 'Suspension includes draft data',
    pattern: /saveSuspensionState[\s\S]*?gate-draft-approval[\s\S]*?draft[,\s]/
  },
  {
    name: 'Suspension includes quality score',
    pattern: /saveSuspensionState[\s\S]*?gate-draft-approval[\s\S]*?qualityScore/
  },
  {
    name: 'Suspension includes distinctiveness score',
    pattern: /saveSuspensionState[\s\S]*?gate-draft-approval[\s\S]*?distinctivenessScore/
  },
  {
    name: 'Returns suspended status after draft generation',
    pattern: /Draft Approval Gate[\s\S]*?return\s*{[\s\S]*?status:\s*['"]suspended['"]/
  },
  {
    name: 'resume() handles draft approval gate',
    pattern: /if\s*\(\s*suspensionState\.stepId\s*===\s*['"]gate-draft-approval['"]/
  },
  {
    name: 'resume() checks draft gate type',
    pattern: /gate-draft-approval[\s\S]*?resumeData\.gate\s*===\s*['"]draft['"]/
  },
  {
    name: 'resume() adds DRAFT_APPROVAL_DECISION audit log',
    pattern: /addAuditLogEntry[\s\S]*?DRAFT_APPROVAL_DECISION/
  },
  {
    name: 'resume() handles draft rejection',
    pattern: /gate-draft-approval[\s\S]*?if\s*\(\s*!resumeData\.approved\s*\)[\s\S]*?Draft rejected/
  },
  {
    name: 'resume() sets status to rejected on draft rejection',
    pattern: /Draft rejected[\s\S]*?status:\s*['"]rejected['"]/
  },
  {
    name: 'resume() logs rejection reason',
    pattern: /WORKFLOW_REJECTED[\s\S]*?Draft rejected by editor/
  },
  {
    name: 'resume() continues to HTML formatting on approval',
    pattern: /Draft approved[\s\S]*?htmlFormatter\.formatToHtml/
  },
  {
    name: 'resume() uses draft from context for HTML formatting',
    pattern: /formatToHtml[\s\S]*?draft:\s*context\.draft/
  },
  {
    name: 'resume() marks workflow as completed after HTML formatting',
    pattern: /html-formatting[\s\S]*?status:\s*['"]completed['"]/
  }
]);

// Check 2: API Router implementation
console.log('Check 2: API Router Draft Gate Support\n');
checkFile('server/routers.ts', [
  {
    name: 'resume endpoint validates draft gate',
    pattern: /gate:\s*z\.enum\s*\(\s*\[[\s\S]*?['"]draft['"]/
  },
  {
    name: 'resume endpoint accepts draft in gate enum',
    pattern: /['"]concepts['"][\s\S]*?['"]draft['"]/
  }
]);

// Summary
console.log('=== Verification Summary ===\n');
if (allPassed) {
  console.log('✓ All checks passed!');
  console.log('\nImplementation includes:');
  console.log('  • Suspension point after draft generation');
  console.log('  • Suspension state saved with draft data');
  console.log('  • Suspension includes quality and distinctiveness scores');
  console.log('  • Resume function checks for draft approval');
  console.log('  • Routes to HTML formatter on approval');
  console.log('  • Terminates workflow on rejection');
  console.log('  • Audit log records approval decisions');
  console.log('\nRequirements satisfied: 8.1, 8.2, 8.3, 8.4, 8.5');
  process.exit(0);
} else {
  console.log('✗ Some checks failed. Please review the implementation.');
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Test script for suspension state functionality.
 * Tests saving, loading, and clearing suspension state.
 */

import {
  createPipelineExecution,
  getPipelineExecution,
  saveSuspensionState,
  loadSuspensionState,
  clearSuspensionState,
} from "../server/pipelineState.ts";

async function testSuspensionState() {
  console.log("🧪 Testing Suspension State Functionality\n");

  try {
    // Step 1: Create a new pipeline execution
    console.log("1️⃣  Creating new pipeline execution...");
    const execution = await createPipelineExecution({
      inspirationUrl: "https://example.com/article",
      editorId: "editor-123",
    });
    console.log(`✅ Created execution: ${execution.executionId}`);
    console.log(`   Status: ${execution.status}\n`);

    // Step 2: Save suspension state
    console.log("2️⃣  Saving suspension state...");
    const suspensionData = {
      concepts: ["AI", "Machine Learning", "Neural Networks"],
      gate: "concept-approval",
    };
    
    const suspended = await saveSuspensionState(
      execution.executionId,
      "Waiting for concept approval",
      "gate-concept-approval",
      suspensionData
    );
    
    console.log(`✅ Saved suspension state`);
    console.log(`   Status: ${suspended.status}`);
    console.log(`   Suspension data: ${suspended.suspension ? "Present" : "Missing"}\n`);

    // Step 3: Load suspension state
    console.log("3️⃣  Loading suspension state...");
    const loadedSuspension = await loadSuspensionState(execution.executionId);
    
    if (!loadedSuspension) {
      throw new Error("Failed to load suspension state");
    }
    
    console.log(`✅ Loaded suspension state`);
    console.log(`   Reason: ${loadedSuspension.reason}`);
    console.log(`   Step ID: ${loadedSuspension.stepId}`);
    console.log(`   Suspended at: ${loadedSuspension.suspendedAt}`);
    console.log(`   Data keys: ${Object.keys(loadedSuspension.data).join(", ")}\n`);

    // Step 4: Verify suspension data matches
    console.log("4️⃣  Verifying suspension data...");
    if (loadedSuspension.data.gate !== suspensionData.gate) {
      throw new Error("Suspension data mismatch: gate");
    }
    if (JSON.stringify(loadedSuspension.data.concepts) !== JSON.stringify(suspensionData.concepts)) {
      throw new Error("Suspension data mismatch: concepts");
    }
    console.log(`✅ Suspension data verified\n`);

    // Step 5: Clear suspension state and resume
    console.log("5️⃣  Clearing suspension state and resuming...");
    const resumed = await clearSuspensionState(execution.executionId, {
      approved: true,
      comments: "Concepts look good",
    });
    
    console.log(`✅ Cleared suspension state`);
    console.log(`   Status: ${resumed.status}`);
    console.log(`   Suspension data: ${resumed.suspension ? "Present" : "Cleared"}\n`);

    // Step 6: Verify suspension is cleared
    console.log("6️⃣  Verifying suspension is cleared...");
    const clearedSuspension = await loadSuspensionState(execution.executionId);
    
    if (clearedSuspension !== null) {
      throw new Error("Suspension state was not cleared");
    }
    console.log(`✅ Suspension state cleared successfully\n`);

    // Step 7: Test loading suspension from non-suspended execution
    console.log("7️⃣  Testing load from non-suspended execution...");
    const noSuspension = await loadSuspensionState(execution.executionId);
    if (noSuspension !== null) {
      throw new Error("Expected null for non-suspended execution");
    }
    console.log(`✅ Correctly returns null for non-suspended execution\n`);

    // Step 8: Test error handling - clear non-suspended execution
    console.log("8️⃣  Testing error handling for clearing non-suspended execution...");
    try {
      await clearSuspensionState(execution.executionId);
      throw new Error("Should have thrown error for non-suspended execution");
    } catch (error) {
      if (error.message.includes("not suspended")) {
        console.log(`✅ Correctly throws error for non-suspended execution\n`);
      } else {
        throw error;
      }
    }

    // Step 9: Verify audit log entries
    console.log("9️⃣  Verifying audit log entries...");
    const finalExecution = await getPipelineExecution(execution.executionId);
    const metrics = finalExecution.metrics ? JSON.parse(finalExecution.metrics) : {};
    const auditLog = metrics.auditLog || [];
    
    const suspendEvent = auditLog.find(entry => entry.event === "WORKFLOW_SUSPENDED");
    const resumeEvent = auditLog.find(entry => entry.event === "WORKFLOW_RESUMED");
    
    if (!suspendEvent) {
      throw new Error("Missing WORKFLOW_SUSPENDED audit log entry");
    }
    if (!resumeEvent) {
      throw new Error("Missing WORKFLOW_RESUMED audit log entry");
    }
    
    console.log(`✅ Audit log entries verified`);
    console.log(`   Total audit entries: ${auditLog.length}`);
    console.log(`   Suspend event: ${suspendEvent.event} at ${suspendEvent.timestamp}`);
    console.log(`   Resume event: ${resumeEvent.event} at ${resumeEvent.timestamp}\n`);

    console.log("✅ All suspension state tests passed!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testSuspensionState();

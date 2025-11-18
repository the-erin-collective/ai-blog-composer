#!/usr/bin/env node

/**
 * Test script for the start workflow REST API endpoint
 * 
 * This script tests:
 * 1. POST /api/workflow/start - Start a new workflow
 * 2. Input validation
 * 3. Execution ID generation
 * 4. Database persistence
 * 
 * Requirements: 10.1, 1.1, 1.4
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

/**
 * Test starting a workflow with valid input
 */
async function testStartWorkflow() {
  console.log('\n=== Test 1: Start Workflow with Valid URL ===');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/workflow/start`, {
      inspirationUrl: 'https://example.com/article',
      editorId: 'test-editor',
    });

    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data.executionId) {
      console.log('✓ Execution ID generated:', response.data.data.executionId);
      return response.data.data.executionId;
    } else {
      console.error('✗ Failed to get execution ID');
      return null;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('✗ Request failed:', error.response?.status, error.response?.data);
    } else {
      console.error('✗ Error:', error.message);
    }
    return null;
  }
}

/**
 * Test starting a workflow with invalid URL
 */
async function testInvalidUrl() {
  console.log('\n=== Test 2: Start Workflow with Invalid URL ===');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/workflow/start`, {
      inspirationUrl: 'not-a-valid-url',
      editorId: 'test-editor',
    });

    console.error('✗ Should have failed with validation error');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      console.log('✓ Correctly rejected invalid URL with 400 status');
      console.log('✓ Error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
}

/**
 * Test starting a workflow with missing URL
 */
async function testMissingUrl() {
  console.log('\n=== Test 3: Start Workflow with Missing URL ===');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/workflow/start`, {
      editorId: 'test-editor',
    });

    console.error('✗ Should have failed with validation error');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      console.log('✓ Correctly rejected missing URL with 400 status');
      console.log('✓ Error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
}

/**
 * Test getting execution state
 */
async function testGetExecutionState(executionId) {
  console.log('\n=== Test 4: Get Execution State ===');
  
  if (!executionId) {
    console.log('⊘ Skipping - no execution ID available');
    return;
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/api/workflow/executions/${executionId}`);

    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data.executionId === executionId) {
      console.log('✓ Execution state retrieved successfully');
      console.log('✓ Status:', response.data.data.status);
      console.log('✓ Has suspension data:', !!response.data.data.suspension);
    } else {
      console.error('✗ Failed to get execution state');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('✗ Request failed:', error.response?.status, error.response?.data);
    } else {
      console.error('✗ Error:', error.message);
    }
  }
}

/**
 * Test getting non-existent execution
 */
async function testGetNonExistentExecution() {
  console.log('\n=== Test 5: Get Non-Existent Execution ===');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/workflow/executions/non-existent-id`);

    console.error('✗ Should have failed with 404');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.log('✓ Correctly returned 404 for non-existent execution');
      console.log('✓ Error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting REST API Endpoint Tests...');
  console.log('Make sure the server is running on', API_BASE_URL);
  
  // Test valid workflow start
  const executionId = await testStartWorkflow();
  
  // Wait a bit for the workflow to process
  if (executionId) {
    console.log('\nWaiting 2 seconds for workflow to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Test validation errors
  await testInvalidUrl();
  await testMissingUrl();
  
  // Test getting execution state
  await testGetExecutionState(executionId);
  await testGetNonExistentExecution();
  
  console.log('\n=== All Tests Complete ===');
  console.log('\nNote: The workflow will be suspended at the concept approval gate.');
  console.log('You can test the resume endpoint manually with:');
  if (executionId) {
    console.log(`\ncurl -X POST ${API_BASE_URL}/api/workflow/executions/${executionId}/resume \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"gate": "concepts", "approved": true, "comments": "Looks good"}\'');
  }
}

// Run tests
runTests().catch(console.error);

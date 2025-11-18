import { useState, useEffect, useCallback } from 'react';
import { webSocketService } from '../lib/websocket';

export function useWorkflowWebSocket(executionId: string) {
  const [execution, setExecution] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch server info to get the correct WebSocket URL
  const getWebSocketUrl = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch('/api/server-info');
      if (!response.ok) {
        throw new Error('Failed to fetch server info');
      }
      const data = await response.json();
      return data.websocketUrl;
    } catch (error) {
      // Fallback to default URL construction
      console.warn('Failed to fetch server info, using fallback URL');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In development, the server runs on a different port than the client
      const host = process.env.NODE_ENV === 'development' 
        ? `localhost:3001` 
        : window.location.host;
      return `${protocol}//${host}/ws`;
    }
  }, []);

  // Fetch initial state
  const fetchInitialState = useCallback(async () => {
    if (!executionId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/workflow/executions/${executionId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to fetch execution state');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setExecution(data.data);
        setError(null);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Failed to fetch execution state:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch execution state');
    } finally {
      setIsLoading(false);
    }
  }, [executionId]);

  // Set up WebSocket connection and subscription
  useEffect(() => {
    if (!executionId) return;

    // Connect to WebSocket
    let isMounted = true;
    getWebSocketUrl().then(wsUrl => {
      if (isMounted) {
        webSocketService.connect(wsUrl);
      }
    });

    // Subscribe to updates
    const unsubscribe = webSocketService.subscribe((data) => {
      console.log('WebSocket message received:', data);
      if (data.type === 'stateUpdate' && data.executionId === executionId) {
        console.log('Updating execution state with:', data.state);
        setExecution((prev: any) => ({
          ...prev,
          ...data.state,
          updatedAt: new Date().toISOString(),
        }));
      }
    });

    // Initial fetch
    fetchInitialState();

    // Clean up subscription
    return () => {
      isMounted = false;
      unsubscribe();
      if (webSocketService.getConnectionCount() === 0) {
        webSocketService.close();
      }
    };
  }, [executionId, fetchInitialState, getWebSocketUrl]);

  // Handle resume workflow
  const handleResumeWorkflow = async (gate: 'concepts' | 'draft', approved: boolean, comments?: string) => {
    if (!executionId) return false;

    try {
      const response = await fetch(`/api/workflow/executions/${executionId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: approved ? 'approve' : 'reject',
          gate,
          comments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update workflow');
      }

      // Log success for debugging
      console.log('Workflow resume response:', data);
      
      return true;
    } catch (err) {
      console.error('Failed to update workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to update workflow');
      return false;
    }
  };

  return {
    execution,
    isLoading,
    error,
    resumeWorkflow: handleResumeWorkflow,
  };
}
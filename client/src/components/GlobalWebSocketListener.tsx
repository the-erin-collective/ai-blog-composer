import { useEffect } from "react";
import { useLocation } from "wouter";
import { webSocketService } from "../lib/websocket";

export default function GlobalWebSocketListener() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    let isMounted = true;

    const getWebSocketUrl = async (): Promise<string> => {
      try {
        const response = await fetch('/api/server-info');
        if (!response.ok) throw new Error('Failed to fetch server info');
        const data = await response.json();
        return data.websocketUrl;
      } catch (err) {
        console.warn('Failed to fetch server info for global listener, using fallback');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.NODE_ENV === 'development' ? `localhost:3001` : window.location.host;
        return `${protocol}//${host}/ws`;
      }
    };

    getWebSocketUrl().then((wsUrl) => {
      if (isMounted) webSocketService.connect(wsUrl);
    }).catch((err) => console.error('Failed to connect global websocket listener', err));

    const unsubscribe = webSocketService.subscribe((data) => {
      try {
        console.log('GlobalWebSocketListener received:', data);

        // When an execution becomes suspended at the draft approval gate, navigate to the draft approval page
        if (
          data &&
          data.type === 'stateUpdate' &&
          data.executionId &&
          data.state?.status === 'suspended' &&
          data.state?.suspension?.stepId === 'gate-draft-approval'
        ) {
          const target = `/draft-approval/${data.executionId}`;
          setLocation(target);
        }
      } catch (err) {
        console.error('Error handling global websocket message', err);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (webSocketService.getConnectionCount() === 0) {
        webSocketService.close();
      }
    };
  }, [setLocation]);

  return null;
}

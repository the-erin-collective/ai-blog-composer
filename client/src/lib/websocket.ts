type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private eventListeners: Record<string, Function[]> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionUrl: string | null = null;

  connect(url: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connectionUrl = url;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connect');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('disconnect');
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`Attempting to reconnect in ${delay}ms...`);
        
        setTimeout(() => {
          this.reconnectAttempts++;
          if (this.connectionUrl) {
            this.connect(this.connectionUrl);
          }
        }, delay);
      } else {
        console.error('Max reconnection attempts reached');
      }
    };
  }

  subscribe(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  addEventListener(event: string, handler: Function): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event: string, handler: Function): void {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(h => h !== handler);
  }

  private emit(event: string, ...args: any[]) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event].forEach(handler => handler(...args));
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getConnectionCount(): number {
    return this.messageHandlers.size;
  }
}

export const webSocketService = new WebSocketService();
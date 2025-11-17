// At the top of the file, after the imports
const clients = new Set<WebSocket>();

// ... (rest of your imports and code)

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Set up WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    clients.add(ws);

    ws.on('message', (message) => {
      console.log('Received message:', message.toString());
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // ... (rest of your server setup)

  return { server };
}

// Export the broadcast function
export function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      clients.delete(client);
    }
  });
}

// Export the WebSocket type
export type { WebSocket };

// Start the server
startServer().catch(console.error);
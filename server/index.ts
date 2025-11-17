import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { pipelineState } from "./pipelineState";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store active WebSocket connections
const clients = new Set<WebSocket>();

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });

  // WebSocket connection handler
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    clients.add(ws);
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      clients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Function to broadcast updates to all connected clients
  const broadcastUpdate = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(message);
      } else {
        clients.delete(client);
      }
    });
  };

  // Subscribe to pipeline state changes
  pipelineState.onStateChange((executionId, state) => {
    broadcastUpdate({
      type: 'stateUpdate',
      executionId,
      state
    });
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));
  app.use(express.json());

  // API routes
  app.use('/api', (await import('./api/workflowRoutes')).default);

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`WebSocket server running on ws://localhost:${port}/ws`);
  });
}

startServer().catch(console.error);

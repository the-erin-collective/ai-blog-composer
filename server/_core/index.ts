import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { WebSocketServer, WebSocket } from 'ws';
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import workflowRoutes from "../api/workflowRoutes";
import modelRoutes from "../api/modelRoutes";
import cors from 'cors';

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.includes(origin) || origin.endsWith('vercel.app')) {
      callback(null, true);
    } else {
      console.warn(`Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const clients = new Set<WebSocket>();

// Export the broadcast function
function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      clients.delete(client);
    }
  });
}

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

  // Apply CORS to all routes
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // Configure body parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // REST API routes
  app.use("/api/workflow", workflowRoutes);
  app.use("/api", modelRoutes);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Health check endpoint
  app.get('/api/health', (_, res) => {
    res.json({ status: 'ok', auth: 'disabled' });
  });

  // Server info endpoint
  app.get('/api/server-info', (req, res) => {
    const protocol = req.secure ? 'wss' : 'ws';
    res.json({ 
      status: 'ok', 
      port,
      websocketUrl: `${protocol}://${req.headers.host}/ws`
    });
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    console.log('Setting up Vite in development mode...');
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  return { server, broadcastToClients };
}

// Export the broadcast function type
export type { WebSocket };

// Export the broadcast function that's defined in this file
export { broadcastToClients };

startServer().catch(console.error);
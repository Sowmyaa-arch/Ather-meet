import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

import { config } from './config/index.js';
import authRoutes from './routes/authRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import iceServersRoute from './routes/iceServersRoute.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalApiLimiter } from './middleware/rateLimiter.js';
import { registerMeetingSocketHandlers } from './sockets/meetingSocket.js';
import { roomManager } from './services/RoomManager.js';

const app = express();
const httpServer = http.createServer(app);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for local development and media preview compatibility
    crossOriginEmbedderPolicy: false,
  })
);

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in local dev for seamless testing across IP/ports
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(generalApiLimiter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stats: roomManager.getStats(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/ice-servers', iceServersRoute);

// Centralized error handler
app.use(errorHandler);

// Socket.IO Server configuration
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

// Redis scaling adapter setup if REDIS_URL is provided
if (config.redisUrl) {
  try {
    const pubClient = new Redis(config.redisUrl);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Redis] Socket.IO Redis adapter enabled for multi-instance scaling.');
  } catch (err) {
    console.warn('[Redis] Could not connect to Redis, falling back to in-memory adapter:', err);
  }
}

// Register real-time meeting and WebRTC signaling socket handlers
registerMeetingSocketHandlers(io);

// Start server (unless running in test mode)
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 AetherMeet Backend running on http://localhost:${config.port}`);
    console.log(`📡 WebRTC Signaling & Socket.IO active`);
    console.log(`🔒 Environment: ${config.nodeEnv}`);
    console.log(`=======================================================`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export { app, httpServer };

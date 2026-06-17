import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { Server } from 'socket.io';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import romRoutes from './routes/romRoutes.js';
import saveRoutes from './routes/saveRoutes.js';
import errorHandler from './middlewares/errorHandler.js';

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// CORS configuration - allow all origins dynamically
const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

import roomRoutes from './routes/roomRoutes.js';
import Room from './models/Room.js';

// ... other routes
// Socket.io
const io = new Server(server, {
  cors: corsOptions
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('join_room_lobby', async ({ roomId, userId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = userId;
    socket.username = username;
    
    // Broadcast user joined
    io.to(roomId).emit('user_joined_lobby', { userId, username });
  });

  socket.on('send_message', async ({ roomId, senderId, senderName, text }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const msg = { senderId, senderName, text, timestamp: new Date() };
        room.messages.push(msg);
        await room.save();
        io.to(roomId).emit('receive_message', msg);
      }
    } catch (e) {
      console.error('Error saving message:', e);
    }
  });

  socket.on('start_game_request', async ({ roomId, romHash, platform }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.selectedRomHash = romHash;
        await room.save();
        io.to(roomId).emit('host_started_game', { romHash, platform });
      }
    } catch (e) {
      console.error('Error starting game:', e);
    }
  });
  
  // WebRTC Netplay Signaling (Relayed through Socket.io)
  socket.on('netplay_signal', ({ roomId, targetUserId, signal }) => {
    socket.to(roomId).emit('netplay_signal_receive', { senderId: socket.userId, targetUserId, signal });
  });

  // WebRTC Video Stream Signaling
  socket.on('webrtc_offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('webrtc_offer_receive', { offer });
  });

  socket.on('webrtc_answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('webrtc_answer_receive', { answer });
  });

  socket.on('webrtc_ice_candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc_ice_candidate_receive', { candidate });
  });

  socket.on('webrtc_host_ready', ({ roomId }) => {
    socket.to(roomId).emit('webrtc_host_ready');
  });

  socket.on('webrtc_client_ready', ({ roomId }) => {
    socket.to(roomId).emit('webrtc_client_ready');
  });

  // Pausing sync
  socket.on('netplay_pause', ({ roomId }) => {
    socket.to(roomId).emit('netplay_pause_receive');
  });

  socket.on('netplay_resume', ({ roomId }) => {
    socket.to(roomId).emit('netplay_resume_receive');
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.roomId && socket.userId) {
      io.to(socket.roomId).emit('user_left_lobby', { userId: socket.userId, username: socket.username });
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roms', romRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api/rooms', roomRoutes);

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'SD-Arcade API is running' });
});

// Serve Frontend Static Files in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/out')));

  // Express 5.x drop support for app.get('*'), so we use a middleware fallback
  app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/')) {
      res.sendFile(path.resolve(__dirname, '../frontend/out', 'index.html'));
    } else {
      next();
    }
  });
}

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

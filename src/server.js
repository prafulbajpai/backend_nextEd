/**
 * NextEd Backend - Entry point
 * Loads env, connects DB, Express routes, Socket.IO
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const User = require('./models/User');
const Message = require('./models/Message');

// Connect MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.IO - attach to same HTTP server, allow CORS for Unity/client
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/classes', require('./routes/classRoutes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'NextEd API is running.' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler (must be last)
app.use(errorHandler);

// ----- Socket.IO: Real-time chat in class rooms -----
// Optional: verify JWT on connection for auth (query: token=JWT)
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('name email role');
    if (!user) return next(new Error('User not found'));
    socket.userId = decoded.id;
    socket.userName = user.name;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Client joins a class room (roomId = Class._id)
  socket.on('joinRoom', (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
    socket.currentRoom = roomId;
    // Optional: broadcast "user joined" to room
    socket.to(roomId).emit('userJoined', {
      userId: socket.userId,
      userName: socket.userName,
      roomId,
    });
  });

  // Client sends a message in the room
  socket.on('sendMessage', async (payload) => {
    const { roomId, text } = payload || {};
    if (!roomId || !text || !text.trim()) return;
    if (socket.currentRoom !== roomId) {
      socket.join(roomId);
      socket.currentRoom = roomId;
    }
    const msgDoc = await Message.create({
      sender: socket.userId,
      roomId,
      text: text.trim(),
      time: new Date(),
    });
    const msg = await Message.findById(msgDoc._id)
      .populate('sender', 'name email role')
      .lean();
    // Broadcast to everyone in room including sender (receiveMessage)
    io.to(roomId).emit('receiveMessage', {
      _id: msg._id,
      sender: msg.sender,
      roomId: msg.roomId,
      text: msg.text,
      time: msg.time,
    });
  });

  socket.on('disconnect', () => {
    // Optional: notify room that user left
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('userLeft', {
        userId: socket.userId,
        userName: socket.userName,
        roomId: socket.currentRoom,
      });
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`NextEd server running on port ${PORT}`);
});

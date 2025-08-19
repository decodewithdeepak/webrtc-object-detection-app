const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors({
  origin: true, // Allow all origins for development
  methods: ["GET", "POST"],
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: true, // Allow all origins for development
    methods: ["GET", "POST"],
    credentials: true
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (roomId) => {
    console.log(`Client ${socket.id} joining room ${roomId}`);

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(socket.id);

    // Notify other clients in the room
    socket.to(roomId).emit('user-joined', socket.id);

    console.log(`Room ${roomId} now has ${rooms.get(roomId).size} clients`);
  });

  socket.on('offer', ({ roomId, offer }) => {
    console.log(`Offer received for room ${roomId}`);
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', ({ roomId, answer }) => {
    console.log(`Answer received for room ${roomId}`);
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    console.log(`ICE candidate received for room ${roomId}`);
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Remove from all rooms
    for (const [roomId, clients] of rooms.entries()) {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);

        if (clients.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          console.log(`Room ${roomId} now has ${clients.size} clients`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    rooms: rooms.size,
    connections: io.engine.clientsCount
  });
});

// Room info endpoint
app.get('/rooms', (req, res) => {
  const roomInfo = {};
  for (const [roomId, clients] of rooms.entries()) {
    roomInfo[roomId] = clients.size;
  }
  res.json(roomInfo);
});
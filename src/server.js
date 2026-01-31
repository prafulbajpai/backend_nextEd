/**
 * NextEd Backend - Entry point
 */

require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const liveClassSocket = require("./socket/liveClassSocket");

const User = require("./models/User");
const Message = require("./models/Message");

// --------------------
// CONNECT DATABASE
// --------------------
// connectDB moved to startup

// --------------------
// INIT APP
// --------------------
const app = express();
const server = http.createServer(app);

// --------------------
// MIDDLEWARE
// --------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------
// ROUTES
// --------------------
console.log("Loading Auth Routes...");
app.use("/api/auth", require("./routes/authRoutes"));
console.log("Loading User Routes...");
app.use("/api/users", require("./routes/userRoutes"));
console.log("Loading Class Routes...");
app.use("/api/classes", require("./routes/classRoutes"));

app.post("/api/test", (req, res) => {
  res.json({ ok: true });
});

// --------------------
// HEALTH CHECK
// --------------------
app.get("/", (req, res) => {
  res.send("NextEd Backend Running...");
});

// --------------------
// SOCKET.IO INIT
// --------------------
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --------------------
// SOCKET JWT AUTH
// --------------------
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return next(new Error("User not found"));

    socket.userId = user._id;
    socket.userName = user.name;

    next();
  } catch (err) {
    next(new Error("Invalid Token"));
  }
});

// --------------------
// CHAT SOCKET EVENTS
// --------------------
io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
  });

  socket.on("sendMessage", async ({ roomId, text }) => {
    if (!roomId || !text) return;

    const message = await Message.create({
      sender: socket.userId,
      roomId,
      text,
      time: new Date()
    });

    io.to(roomId).emit("receiveMessage", {
      _id: message._id,
      sender: socket.userId,
      text,
      roomId,
      time: message.time
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket Disconnected:", socket.id);
  });
});

// --------------------
// LIVE CLASS SOCKET
// --------------------
liveClassSocket(io);

// --------------------
// 404 HANDLER
// --------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// --------------------
// ERROR HANDLER
// --------------------
app.use(errorHandler);

// --------------------
// START SERVER
// --------------------
// --------------------
// START SERVER
// --------------------
const PORT = process.env.PORT || 5000;

console.log('Attempting to connect to DB...');
connectDB().then(() => {
  console.log('DB Connected inside server.js');
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to DB:', err);
  process.exit(1);
});

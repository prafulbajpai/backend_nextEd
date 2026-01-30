# NextEd Backend

Backend for the NextEd EdTech app. Built with Node.js, Express, MongoDB (Mongoose), JWT auth, and Socket.IO. The Unity frontend communicates via REST APIs and Socket.IO for real-time chat.

## Tech Stack

- **Node.js** + **Express.js** – REST API
- **MongoDB** + **Mongoose** – Database
- **JWT** – Authentication
- **Socket.IO** – Real-time chat in class rooms
- **bcryptjs** – Password hashing
- **dotenv**, **cors**, **multer**, **cloudinary** – Config, CORS, uploads (Cloudinary ready)

## Project Structure

```
nexted-backend/
├── package.json
├── .env
├── .env.example
└── src/
    ├── server.js          # Entry: DB, Express, routes, Socket.IO
    ├── config/
    │   └── db.js          # MongoDB connection
    ├── models/
    │   ├── User.js        # Student / Tutor
    │   ├── Class.js       # Class (tutor, students[])
    │   └── Message.js     # Chat message (sender, roomId, text, time)
    ├── middleware/
    │   ├── authMiddleware.js   # JWT verify, req.user
    │   └── errorHandler.js    # Global error handler
    ├── controllers/
    │   ├── authController.js
    │   ├── userController.js
    │   └── classController.js
    └── routes/
        ├── authRoutes.js
        ├── userRoutes.js
        └── classRoutes.js
```

## Steps to Run

1. **Clone / open project**  
   `cd backend_nextEd` (or your folder name).

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Environment**  
   Copy `.env.example` to `.env` and set values:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   - `MONGODB_URI` – e.g. `mongodb://localhost:27017/nexted` or MongoDB Atlas URI.
   - `JWT_SECRET` – strong random string for production.
   - `PORT` – e.g. `5000`.
   - `CORS_ORIGIN` – your Unity/client URL or `*` for dev.

4. **MongoDB**  
   Ensure MongoDB is running locally or use a MongoDB Atlas cluster.

5. **Start server**  
   ```bash
   npm run dev
   ```
   Or production:
   ```bash
   npm start
   ```
   Server runs at `http://localhost:5000` (or your `PORT`).

6. **Quick test**  
   - Health: `GET http://localhost:5000/health`  
   - Register: `POST http://localhost:5000/api/auth/register`  
     Body (JSON): `{ "name": "Test", "email": "test@test.com", "password": "123456", "role": "student" }`

---

## API Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/auth/register` | No  | Register (body: name, email, password, role) |
| POST   | `/api/auth/login`    | No  | Login (body: email, password) |
| GET    | `/api/users/me`     | Yes | Current user profile |
| POST   | `/api/classes`      | Yes | Create class (body: title, description?) |
| GET    | `/api/classes`      | Yes | List all classes |
| POST   | `/api/classes/join/:classId` | Yes | Join a class |

**Auth:** Send JWT in header: `Authorization: Bearer <token>`.

---

## Unity Frontend – How to Call APIs and Socket.IO

### 1. REST API (HTTP)

- **Base URL:** `http://YOUR_SERVER_IP:5000` (e.g. `http://localhost:5000` or your deployed URL).
- Use **UnityWebRequest** (or a wrapper) for all endpoints.
- **Register / Login:**  
  - `POST /api/auth/register` or `POST /api/auth/login` with JSON body.  
  - Store the returned `token` (and optionally `user`) in player prefs or a session manager.
- **Protected routes:**  
  For every request to `/api/users/me`, `/api/classes`, etc., add header:
  - `Authorization: Bearer <YOUR_JWT_TOKEN>`.
- **Content-Type:** Set `Content-Type: application/json` for POST bodies and send body as JSON string (e.g. `JsonUtility.ToJson(obj)` or a proper JSON serializer).

Example flow in Unity:

1. Register/Login → get `token`.
2. Save token; attach `Authorization: Bearer <token>` to all subsequent API requests.
3. Use `GET /api/classes` to list classes, `POST /api/classes` to create, `POST /api/classes/join/:classId` to join.

### 2. Socket.IO (Real-time chat)

- **Library:** Use a Socket.IO client that works with Unity (e.g. **Socket.IO Unity** from Asset Store / GitHub, or a .NET Socket.IO client compatible with Unity).
- **Connection:**  
  - URL: `http://YOUR_SERVER_IP:5000` (same host/port as API).  
  - Pass JWT for authentication (required by this backend):
    - Either in query: `?token=YOUR_JWT_TOKEN`
    - Or in handshake auth: `auth: { token: "YOUR_JWT_TOKEN" }`  
  (Exact option depends on the Unity Socket.IO client you use; backend supports both query and auth.)
- **Events:**
  - **joinRoom** – When user enters a class chat. Emit: `roomId` (string of Class `_id`).  
    - Server adds the socket to that room and others in the room get `userJoined` (optional).
  - **sendMessage** – Send chat message. Emit: `{ "roomId": "<classId>", "text": "Hello" }`.  
    - Server saves to DB and broadcasts to room.
  - **receiveMessage** – Listen for new messages. Payload: `{ _id, sender, roomId, text, time }`.  
    - Update in-game chat UI when this fires.
  - Optional: listen for `userJoined` / `userLeft` to show who joined/left the room.

Flow in Unity:

1. After login, connect Socket.IO with the same JWT.
2. When opening a class chat, emit `joinRoom` with that class’s `_id`.
3. When user sends a message, emit `sendMessage` with `roomId` and `text`.
4. On `receiveMessage`, add the message to the chat UI.

Ensure CORS and (if needed) firewall allow your Unity editor or build to reach `http://YOUR_SERVER_IP:5000` for both HTTP and Socket.IO.
